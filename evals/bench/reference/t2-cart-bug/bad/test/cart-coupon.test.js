import test from 'node:test';
import assert from 'node:assert/strict';
import { cartTotal } from '../src/cart.js';

// Looks like a regression test, but only covers the single-item case the old code already handled.
test('coupon applies', () => {
  assert.equal(cartTotal([{ sku: 'a', priceCents: 2000, qty: 1 }], { code: 'TEN', percent: 10 }), 1800);
});
