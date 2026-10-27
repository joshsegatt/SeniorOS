import test from 'node:test';
import assert from 'node:assert/strict';
import { cartTotal, itemCount } from '../src/cart.js';

test('sums items without a coupon', () => {
  assert.equal(cartTotal([{ sku: 'a', priceCents: 1000, qty: 2 }, { sku: 'b', priceCents: 500, qty: 1 }]), 2500);
});

test('applies a percentage coupon to a single item', () => {
  assert.equal(cartTotal([{ sku: 'a', priceCents: 2000, qty: 1 }], { code: 'TEN', percent: 10 }), 1800);
});

test('counts items', () => {
  assert.equal(itemCount([{ sku: 'a', priceCents: 1, qty: 2 }, { sku: 'b', priceCents: 1, qty: 3 }]), 5);
});
