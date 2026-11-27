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
  #timers = new Set();
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
    this.#pump();
  }

  stop() {
    this.#stopped = true;
    for (const handle of this.#timers) this.#clock.clearTimeout(handle);
    this.#timers.clear();
  }

  #log(msg) {
    this.#logger?.(msg);
  }

  #pump() {
    if (!this.#started || this.#stopped) return;
    const now = this.#clock.now();
    for (const job of this.#store.list({ status: 'queued' })) {
      if (this.#running >= this.#concurrency) break;
      if (job.runAt <= now) this.#run(job);
    }
  }

  async #run(job) {
    this.#running++;
    const attempt = job.attempts + 1;
    this.#store.update(job.id, { status: 'running', attempts: attempt });
    const handler = this.#handlers[job.type];
    try {
      await this.#withTimeout(handler(job.payload, { jobId: job.id, attempt }));
      if (this.#stopped) return;
      this.#store.update(job.id, { status: 'done', lastError: null, finishedAt: this.#clock.now() });
      this.#log(`${job.type} ${job.id} attempt ${attempt} ok`);
    } catch (err) {
      if (this.#stopped) return;
      this.#log(`${job.type} ${job.id} attempt ${attempt} failed: ${err.message}`);
      if (attempt >= this.#maxAttempts) {
        this.#store.update(job.id, { status: 'failed', lastError: err.message, finishedAt: this.#clock.now() });
      } else {
        const delay = backoffDelay(attempt, this.#backoff);
        this.#store.update(job.id, { status: 'retrying', lastError: err.message, runAt: this.#clock.now() + delay });
        this.#scheduleRetry(job.id, delay);
      }
    } finally {
      this.#running--;
      this.#pump();
    }
  }

  #scheduleRetry(id, delay) {
    const handle = this.#clock.setTimeout(() => {
      this.#timers.delete(handle);
      this.#store.update(id, { status: 'queued' });
      this.#pump();
    }, delay);
    this.#timers.add(handle);
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
