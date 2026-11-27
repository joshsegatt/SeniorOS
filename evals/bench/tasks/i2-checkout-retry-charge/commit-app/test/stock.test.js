import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStock } from '../src/stock.js';
import { createCatalog } from '../src/catalog.js';
import { OutOfStockError } from '../src/errors.js';

const catalog = createCatalog();
const line = (sku, qty) => ({ item: catalog.get(sku), qty });

test('reserve is all or nothing', () => {
  const stock = createStock({ 'BOOK-1': 2, 'LAMP-2': 0 });
  assert.throws(() => stock.reserve([line('BOOK-1', 1), line('LAMP-2', 1)]), OutOfStockError);
  assert.equal(stock.available('BOOK-1'), 2);
});

test('digital items have no stock to reserve', () => {
  const stock = createStock({ 'BOOK-1': 2 });
  stock.reserve([line('BOOK-1', 1), line('GIFT-50', 4)]);
  assert.equal(stock.available('BOOK-1'), 1);
  stock.release([line('BOOK-1', 1), line('GIFT-50', 4)]);
  assert.equal(stock.available('BOOK-1'), 2);
});
