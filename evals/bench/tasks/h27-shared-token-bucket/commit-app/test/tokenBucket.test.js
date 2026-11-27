import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, refill, msUntil, encode, decode } from '../src/tokenBucket.js';

const config = { capacity: 10, ratePerSec: 2 };

test('a new bucket starts full', () => {
  assert.deepEqual(initialState(500, config), { tokens: 10, updatedAt: 500 });
});

test('refill adds ratePerSec tokens per second', () => {
  const state = refill({ tokens: 1, updatedAt: 0 }, 2000, config);
  assert.equal(state.tokens, 5);
  assert.equal(state.updatedAt, 2000);
});

test('refill never exceeds capacity', () => {
  assert.equal(refill({ tokens: 9, updatedAt: 0 }, 60_000, config).tokens, 10);
});

test('msUntil is 0 when enough tokens, otherwise the refill time', () => {
  assert.equal(msUntil({ tokens: 3, updatedAt: 0 }, 2, config), 0);
  assert.equal(msUntil({ tokens: 0, updatedAt: 0 }, 1, config), 500);
  assert.equal(msUntil({ tokens: 0, updatedAt: 0 }, 3, config), 1500);
});

test('encode/decode round-trip', () => {
  assert.deepEqual(decode(encode({ tokens: 4, updatedAt: 12 })), { tokens: 4, updatedAt: 12 });
  assert.equal(decode(null), null);
});
