import { systemClock } from './clock.js';
import { backoffDelay } from './backoff.js';

export class AttemptTimeoutError extends Error {
  constructor(ms) {
    super(`attempt timed out after ${ms}ms`);
    this.name = 'AttemptTimeoutError';
  }
}

// Persistent job queue with bounded concurrency, a per-attempt timeout and
// retries with exponential backoff.
//
// Delivery is at-least-once: a job whose attempt timed out, failed, or was left
// `running` by a worker that died is run again, so handlers must be idempotent.
// Everything the queue needs to resume lives in the store (status + runAt), so a
// new worker on the same store picks up queued, retrying and orphaned jobs.
export class JobQueue {
  #store;
  #handlers;
  #clock;
  #concurrency;
  #maxAttempts;
  #attemptTimeoutMs;
  #backoff;
  #logger;
  #running = 0;
  #started = false;
  #stopped = false;
  #inflight = new Set();
  #wake = null;
  #seq = 0;

  constructor({
    store,
    handlers,
    clock = systemClock,
    concurrency = 4,
    maxAttempts = 5,
    attemptTimeoutMs = 30_000,
    backoff = {},
    logger = null,
  }) {
    this.#store = store;
    this.#handlers = handlers;
    this.#clock = clock;
    this.#concurrency = concurrency;
    this.#maxAttempts = maxAttempts;
    this.#attemptTimeoutMs = attemptTimeoutMs;
    this.#backoff = backoff;
    this.#logger = logger;
  }

  enqueue(type, payload, { id } = {}) {
    if (!this.#handlers[type]) throw new Error(`no handler for job type "${type}"`);
    const job = {
      id: id ?? `job-${this.#clock.now()}-${++this.#seq}`,
      type,
      payload,
      status: 'queued',
      attempts: 0,
      runAt: this.#clock.now(),
      lastError: null,
      finishedAt: null,
    };
    this.#store.insert(job);
    this.#pump();
    return job.id;
  }

  start() {
    if (this.#started && !this.#stopped) return;
    this.#started = true;
    this.#stopped = false;
    // A job still marked `running` here was orphaned by a worker that was killed
    // mid-attempt (this instance has nothing in flight). Run it again.
    if (this.#inflight.size === 0) {
      for (const job of this.#store.list({ status: 'running' })) {
        this.#store.update(job.id, { status: 'queued', runAt: this.#clock.now() });
      }
    }
    this.#pump();
  }

  // Stops taking new attempts and resolves once the attempts in flight have
  // settled and their outcome is recorded. Jobs waiting for a retry stay
  // `retrying` in the store and are picked up by the next start().
  async stop() {
    this.#stopped = true;
    this.#disarm();
    await Promise.allSettled([...this.#inflight]);
  }

  #log(msg) {
    this.#logger?.(msg);
  }

  #pump() {
    if (!this.#started || this.#stopped) return;
    const now = this.#clock.now();
    let nextRunAt = Infinity;
    for (const job of this.#store.list({ status: ['queued', 'retrying'] })) {
      if (job.runAt > now) {
        nextRunAt = Math.min(nextRunAt, job.runAt);
      } else if (this.#running < this.#concurrency) {
        this.#run(job);
      }
    }
    this.#disarm();
    if (nextRunAt !== Infinity) {
      this.#wake = this.#clock.setTimeout(() => {
        this.#wake = null;
        this.#pump();
      }, nextRunAt - now);
    }
  }

  #disarm() {
    if (this.#wake !== null) {
      this.#clock.clearTimeout(this.#wake);
      this.#wake = null;
    }
  }

  #run(job) {
    const attempt = this.#attempt(job);
    this.#inflight.add(attempt);
    attempt.finally(() => this.#inflight.delete(attempt));
  }

  async #attempt(job) {
    this.#running++;
    const attempt = job.attempts + 1;
    this.#store.update(job.id, { status: 'running', attempts: attempt });
    const handler = this.#handlers[job.type];
    try {
      await this.#withTimeout(handler(job.payload, { jobId: job.id, attempt }));
      this.#store.update(job.id, { status: 'done', lastError: null, finishedAt: this.#clock.now() });
      this.#log(`${job.type} ${job.id} attempt ${attempt} ok`);
    } catch (err) {
      this.#log(`${job.type} ${job.id} attempt ${attempt} failed: ${err.message}`);
      if (attempt >= this.#maxAttempts) {
        this.#store.update(job.id, { status: 'failed', lastError: err.message, finishedAt: this.#clock.now() });
      } else {
        const delay = backoffDelay(attempt, this.#backoff);
        this.#store.update(job.id, { status: 'retrying', lastError: err.message, runAt: this.#clock.now() + delay });
      }
    } finally {
      this.#running--;
      this.#pump();
    }
  }

  #withTimeout(promise) {
    let handle;
    const timeout = new Promise((_, reject) => {
      handle = this.#clock.setTimeout(
        () => reject(new AttemptTimeoutError(this.#attemptTimeoutMs)),
        this.#attemptTimeoutMs,
      );
    });
    return Promise.race([promise, timeout]).finally(() => this.#clock.clearTimeout(handle));
  }
}
