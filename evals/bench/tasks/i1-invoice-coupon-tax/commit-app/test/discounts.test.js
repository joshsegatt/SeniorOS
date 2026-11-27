import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discountFor } from '../src/discounts.js';

test('no coupon, no discount', () => {
  assert.equal(discountFor(5000, null), 0);
});

test('percent coupon rounds half up', () => {
  assert.equal(discountFor(7500, { type: 'percent', value: 10 }), 750);
  assert.equal(discountFor(995, { type: 'percent', value: 10 }), 100); // 99.5
});

test('fixed coupon never exceeds the subtotal', () => {
  assert.equal(discountFor(10000, { type: 'fixed', cents: 1000 }), 1000);
  assert.equal(discountFor(500, { type: 'fixed', cents: 1000 }), 500);
});

test('unknown coupon type is rejected', () => {
  assert.throws(() => discountFor(100, { type: 'bogus' }), TypeError);
});
