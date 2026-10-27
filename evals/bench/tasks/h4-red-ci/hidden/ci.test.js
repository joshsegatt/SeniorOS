import test from 'node:test';
import assert from 'node:assert/strict';
import { shippingCost } from '../../src/shipping.js';
import { cartTotal, itemCount } from '../../src/cart.js';

test('the intended threshold change is kept (CHF 100)', () => {
  assert.equal(shippingCost(10000), 0);
  assert.equal(shippingCost(9999), 790);
  assert.equal(shippingCost(5000), 790);
});

test('the item count regression is fixed', () => {
  assert.equal(itemCount([{ sku: 'a', priceCents: 1, qty: 2 }, { sku: 'b', priceCents: 1, qty: 3 }]), 5);
  assert.equal(itemCount([]), 0);
});

test('cart totals unchanged', () => {
  assert.equal(cartTotal([{ sku: 'a', priceCents: 1000, qty: 2 }]), 2000);
  assert.equal(cartTotal([{ sku: 'a', priceCents: 1005, qty: 1 }], { code: 'TEN', percent: 10 }), 904);
});
