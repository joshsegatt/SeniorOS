import test from 'node:test';
import assert from 'node:assert/strict';
import { productUrl } from '../src/products.js';
import { imageKey } from '../src/storage.js';
import { percentOf, formatCHF } from '../src/money.js';
import { shippingCost } from '../src/shipping.js';

test('product url', () => {
  assert.equal(productUrl('Plain Cake'), '/p/plain-cake');
});

test('image key', () => {
  assert.equal(imageKey('Plain Cake'), 'img/plain-cake.jpg');
});

test('money helpers', () => {
  assert.equal(percentOf(2000, 10), 200);
  assert.equal(formatCHF(12345), 'CHF 123.45');
});

test('free shipping from the threshold (CHF 100, decision 2026-10-20)', () => {
  assert.equal(shippingCost(10000), 0);
  assert.equal(shippingCost(9999), 790);
});
