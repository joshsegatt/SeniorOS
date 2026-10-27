import test from 'node:test';
import assert from 'node:assert/strict';
import { cartTotal, itemCount } from '../../src/cart.js';

const items = [{ sku: 'a', priceCents: 1000, qty: 2 }, { sku: 'b', priceCents: 500, qty: 1 }];

test('coupon applies to the whole cart', () => {
  assert.equal(cartTotal(items, { code: 'TEN', percent: 10 }), 2250);
});

test('coupon with three lines', () => {
  const three = [...items, { sku: 'c', priceCents: 2500, qty: 2 }];
  assert.equal(cartTotal(three, { code: 'TWENTY', percent: 20 }), 6000);
});

test('existing behavior kept', () => {
  assert.equal(cartTotal(items), 2500);
  assert.equal(cartTotal([{ sku: 'a', priceCents: 2000, qty: 1 }], { code: 'TEN', percent: 10 }), 1800);
  assert.equal(cartTotal([], { code: 'TEN', percent: 10 }), 0);
  assert.equal(itemCount(items), 3);
});
