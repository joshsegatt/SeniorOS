import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quoteShipping, shippableGrams } from '../src/shipping-rates.js';
import { createCatalog } from '../src/catalog.js';

const catalog = createCatalog();
const line = (sku, qty) => ({ item: catalog.get(sku), qty });

test('digital items weigh nothing', () => {
  assert.equal(shippableGrams([line('BOOK-1', 1), line('GIFT-50', 3)]), 600);
});

test('shipping tiers', () => {
  assert.equal(quoteShipping([line('GIFT-50', 1)]), 0);
  assert.equal(quoteShipping([line('BOOK-1', 3)]), 700);
  assert.equal(quoteShipping([line('LAMP-2', 1)]), 1200);
  assert.equal(quoteShipping([line('BENCH-3', 1)]), 2500);
});
