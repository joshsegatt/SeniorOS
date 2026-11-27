import test from 'node:test';
import assert from 'node:assert/strict';
import { JobQueue, JobStore, createFakeClock } from '../src/index.js';

function setup(handlers, options = {}) {
  const clock = createFakeClock();
  const store = new JobStore();
  const queue = new JobQueue({ store, clock, handlers, ...options });
  return { clock, store, queue };
}

test('runs a queued job to done', async () => {
  const seen = [];
  const { clock, store, queue } = setup({ echo: async (payload) => seen.push(payload.n) });
  const id = queue.enqueue('echo', { n: 1 });
  queue.start();
  await clock.advance(0);
  assert.deepEqual(seen, [1]);
  assert.equal(store.get(id).status, 'done');
  assert.equal(store.get(id).attempts, 1);
});

test('retries a failing job with exponential backoff', async () => {
  const startedAt = [];
  const { clock, store, queue } = setup(
    {
      flaky: async () => {
        startedAt.push(clock.now());
        if (startedAt.length < 3) throw new Error('boom');
      },
    },
    { backoff: { baseMs: 1000 } },
  );
  const id = queue.enqueue('flaky', {});
  queue.start();
  await clock.advance(10_000);
  assert.deepEqual(startedAt, [0, 1000, 3000]);
  assert.equal(store.get(id).status, 'done');
  assert.equal(store.get(id).attempts, 3);
});

test('gives up after maxAttempts', async () => {
  const { clock, store, queue } = setup(
    { broken: async () => { throw new Error('nope'); } },
    { maxAttempts: 3, backoff: { baseMs: 100 } },
  );
  const id = queue.enqueue('broken', {});
  queue.start();
  await clock.advance(10_000);
  const job = store.get(id);
  assert.equal(job.status, 'failed');
  assert.equal(job.attempts, 3);
  assert.equal(job.lastError, 'nope');
});

test('a hung attempt times out and is retried', async () => {
  let calls = 0;
  const { clock, store, queue } = setup(
    {
      slow: async () => {
        calls++;
        if (calls === 1) await new Promise(() => {});
      },
    },
    { attemptTimeoutMs: 5000, backoff: { baseMs: 1000 } },
  );
  const id = queue.enqueue('slow', {});
  queue.start();
  await clock.advance(5000);
  assert.equal(store.get(id).status, 'retrying');
  assert.match(store.get(id).lastError, /timed out/);
  await clock.advance(1000);
  assert.equal(store.get(id).status, 'done');
  assert.equal(calls, 2);
});

test('respects the concurrency limit', async () => {
  let active = 0;
  let peak = 0;
  const { clock, queue } = setup(
    {
      work: async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((resolve) => clock.setTimeout(resolve, 100));
        active--;
      },
    },
    { concurrency: 2 },
  );
  for (let i = 0; i < 6; i++) queue.enqueue('work', { i });
  queue.start();
  await clock.advance(1000);
  assert.equal(peak, 2);
  assert.equal(active, 0);
});
