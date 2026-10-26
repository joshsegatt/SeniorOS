import test from 'node:test';
import assert from 'node:assert/strict';
import { cartTotal } from '../src/cart.js';

test('coupon applies to every item in the cart', () => {
  const items = [{ sku: 'a', priceCents: 1000, qty: 2 }, { sku: 'b', priceCents: 500, qty: 1 }];
  assert.equal(cartTotal(items, { code: 'TEN', percent: 10 }), 2250);
});
