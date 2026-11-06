import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { createApi } from '../src/api/router.js';
import { createRateLimiter } from '../src/limits/rate-limiter.js';

const north = { 'x-api-key': 'pk_test_north' };
const lumen = { 'x-api-key': 'pk_test_lumen' };
const products = (headers) => ({ method: 'GET', path: '/v1/products', headers });

test('allows 10 requests per second per key and rejects the 11th', async () => {
  const api = createApi();
  // A partner client polling every 20 ms: the first ten calls fit in the limit, the eleventh does not.
  for (let i = 0; i < 10; i += 1) {
    assert.equal(api.handle(products(north)).status, 200, `request ${i + 1}`);
    await sleep(20);
  }
  assert.equal(api.handle(products(north)).status, 429);
});

test('keys are limited independently', () => {
  const api = createApi({ now: () => 5_000 });
  for (let i = 0; i < 10; i += 1) api.handle(products(north));
  assert.equal(api.handle(products(north)).status, 429);
  assert.equal(api.handle(products(lumen)).status, 200);
});

test('a key may call again once its earlier requests are older than the window', () => {
  let t = 100;
  const limiter = createRateLimiter({ limit: 3, windowMs: 1000, now: () => t });
  for (const at of [100, 200, 300]) {
    t = at;
    assert.equal(limiter.hit('k'), true);
  }
  t = 400;
  assert.equal(limiter.hit('k'), false);
  t = 1500;
  assert.equal(limiter.hit('k'), true);
});

test('rejects an unknown API key', () => {
  assert.equal(createApi().handle(products({ 'x-api-key': 'pk_nope' })).status, 401);
});
