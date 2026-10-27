import test from 'node:test';
import assert from 'node:assert/strict';
import { cartTotal } from '../../src/cart.js';

const one = (priceCents) => [{ sku: 'x', priceCents, qty: 1 }];

test('loyalty discount uses banker\'s rounding (percentOf)', () => {
  // Each naive rounding gets one of these wrong: Math.round(total * 0.85) fails 1010,
  // total - Math.round(total * 0.15) fails 1030.
  assert.equal(cartTotal(one(1030), undefined, { loyalty: true }), 876); // discount 154.5 -> 154
  assert.equal(cartTotal(one(1010), undefined, { loyalty: true }), 858); // discount 151.5 -> 152
  assert.equal(cartTotal(one(2000), undefined, { loyalty: true }), 1700);
});

test('loyalty applies after the coupon', () => {
  assert.equal(cartTotal(one(2000), { code: 'TEN', percent: 10 }, { loyalty: true }), 1530);
});

test('without loyalty nothing changes, legacy coupon rounding included', () => {
  assert.equal(cartTotal(one(1030)), 1030);
  assert.equal(cartTotal(one(1005), { code: 'TEN', percent: 10 }), 904); // Math.round(100.5) = 101
  assert.equal(cartTotal(one(1005), { code: 'TEN', percent: 10 }, { loyalty: false }), 904);
});
