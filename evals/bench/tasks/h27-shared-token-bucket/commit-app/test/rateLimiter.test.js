import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter, MemoryStore, createManualClock, RateLimitError } from '../src/index.js';

test('allows a burst up to capacity, then denies with a retry hint', async () => {
  const clock = createManualClock(1000);
  const limiter = createRateLimiter({ store: new MemoryStore(), clock, capacity: 3, ratePerSec: 1 });
  for (let i = 0; i < 3; i++) assert.equal((await limiter.tryTake('a')).allowed, true);
  const denied = await limiter.tryTake('a');
  assert.equal(denied.allowed, false);
  assert.equal(denied.retryAfterMs, 1000);
});

test('tokens come back over time', async () => {
  const clock = createManualClock(0);
  const limiter = createRateLimiter({ store: new MemoryStore(), clock, capacity: 2, ratePerSec: 1 });
  await limiter.tryTake('a');
  await limiter.tryTake('a');
  assert.equal((await limiter.tryTake('a')).allowed, false);
  clock.advance(1000);
  assert.equal((await limiter.tryTake('a')).allowed, true);
  assert.equal((await limiter.tryTake('a')).allowed, false);
});

test('keys have independent budgets', async () => {
  const clock = createManualClock(0);
  const limiter = createRateLimiter({ store: new MemoryStore(), clock, capacity: 1, ratePerSec: 1 });
  assert.equal((await limiter.tryTake('a')).allowed, true);
  assert.equal((await limiter.tryTake('b')).allowed, true);
  assert.equal((await limiter.tryTake('a')).allowed, false);
});

test('two instances on one store share the budget', async () => {
  const clock = createManualClock(0);
  const store = new MemoryStore();
  const a = createRateLimiter({ store, clock, capacity: 2, ratePerSec: 1 });
  const b = createRateLimiter({ store, clock, capacity: 2, ratePerSec: 1 });
  assert.equal((await a.tryTake('k')).allowed, true);
  assert.equal((await b.tryTake('k')).allowed, true);
  assert.equal((await a.tryTake('k')).allowed, false);
  assert.equal((await b.tryTake('k')).allowed, false);
});

test('acquire waits for a token', async () => {
  const clock = createManualClock(0);
  const limiter = createRateLimiter({ store: new MemoryStore(), clock, capacity: 1, ratePerSec: 2 });
  await limiter.acquire('a');
  let done = false;
  const pending = limiter.acquire('a').then(() => { done = true; });
  await new Promise((r) => setImmediate(r));
  assert.equal(done, false);
  clock.advance(500);
  await pending;
  assert.equal(done, true);
});

test('acquire gives up when the wait would exceed maxWaitMs', async () => {
  const clock = createManualClock(0);
  const limiter = createRateLimiter({ store: new MemoryStore(), clock, capacity: 1, ratePerSec: 1 });
  await limiter.acquire('a');
  await assert.rejects(limiter.acquire('a', { maxWaitMs: 200 }), RateLimitError);
});

test('asking for more than capacity is an error', async () => {
  const limiter = createRateLimiter({ store: new MemoryStore(), clock: createManualClock(0), capacity: 2, ratePerSec: 1 });
  await assert.rejects(limiter.tryTake('a', 3), /cannot take 3/);
});
