import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from '../../src/limits/rate-limiter.js';
import { createApi } from '../../src/api/router.js';
import { createLoginGuard } from '../../src/auth/login-guard.js';
import { hashPassword } from '../../src/auth/passwords.js';

const north = { 'x-api-key': 'pk_test_north' };
const products = { method: 'GET', path: '/v1/products', headers: north };

test('the reported case: ten calls just before a second boundary, the eleventh just after', () => {
  let t = 0;
  const api = createApi({ now: () => t });
  for (let i = 0; i < 10; i += 1) {
    t = 4_810 + i * 20; // 4810 ... 4990
    assert.equal(api.handle(products).status, 200, `request ${i + 1}`);
  }
  t = 5_010;
  assert.equal(api.handle(products).status, 429);
  t = 5_500;
  assert.equal(api.handle(products).status, 429);
});

test('a burst on each side of a boundary is not twice the limit', () => {
  let t = 0;
  const limiter = createRateLimiter({ limit: 10, windowMs: 1000, now: () => t });
  let allowed = 0;
  for (let i = 0; i < 10; i += 1) { t = 1_990 + i; if (limiter.hit('k')) allowed += 1; }
  for (let i = 0; i < 10; i += 1) { t = 2_001 + i; if (limiter.hit('k')) allowed += 1; }
  assert.equal(allowed, 10);
});

test('the period is rolling: capacity comes back request by request, not all at once', () => {
  let t = 0;
  const limiter = createRateLimiter({ limit: 10, windowMs: 1000, now: () => t });
  t = 0;
  assert.equal(limiter.hit('k'), true);
  for (let i = 0; i < 9; i += 1) { t = 900 + i; assert.equal(limiter.hit('k'), true); }
  // At 1050 only the request from t=0 is older than one second: one slot, not ten.
  let allowed = 0;
  for (let i = 0; i < 10; i += 1) { t = 1_050 + i; if (limiter.hit('k')) allowed += 1; }
  assert.equal(allowed, 1);
  // Once all of them are older than a second, the key has its full limit again.
  allowed = 0;
  for (let i = 0; i < 10; i += 1) { t = 3_000 + i; if (limiter.hit('k')) allowed += 1; }
  assert.equal(allowed, 10);
});

test('no one-second period ever sees more than 10 accepted requests from a key', () => {
  let t = 0;
  const limiter = createRateLimiter({ limit: 10, windowMs: 1000, now: () => t });
  const accepted = [];
  for (t = 0; t < 6_000; t += 37) if (limiter.hit('k')) accepted.push(t);
  for (const start of accepted) {
    const inPeriod = accepted.filter((a) => a >= start && a < start + 1000).length;
    assert.ok(inPeriod <= 10, `${inPeriod} accepted in the second starting at ${start}`);
  }
  assert.ok(accepted.length >= 10);
});

test('login: 5 attempts just before a 15-minute boundary still lock the account just after it', () => {
  const accounts = new Map([['ops@shop.test', { passwordHash: hashPassword('correct horse'), role: 'admin' }]]);
  let t = 0;
  const guard = createLoginGuard({ accounts, now: () => t });
  for (let i = 0; i < 5; i += 1) {
    t = 899_000 + i * 100;
    assert.equal(guard.login('ops@shop.test', 'guess').status, 401);
  }
  t = 900_500;
  assert.equal(guard.login('ops@shop.test', 'correct horse').status, 429);
  t = 899_000 + 15 * 60 * 1000 + 1_000;
  assert.equal(guard.login('ops@shop.test', 'correct horse').status, 200);
});
