import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductStore } from '../../src/catalog/products.js';
import { merchantFeed } from '../../src/feeds/merchant.js';

test('feed with the default config', async () => {
  const s = createProductStore();
  s.put({ sku: 'MUG-1', title: 'Blue Mug', price: 1500, stock: 3, active: true });
  s.put({ sku: 'MUG-2', title: 'Red Mug', price: 1299, stock: 0, active: true });
  s.put({ sku: 'MUG-3', title: 'Old Mug', price: 990, stock: 9, active: false });
  const [header, ...rows] = (await merchantFeed(s)).split(/\r?\n/).filter((l) => l !== '').map((l) => l.split('\t'));
  assert.deepEqual(header.map((h) => h.trim()), ['id', 'title', 'link', 'price', 'availability']);
  assert.deepEqual(rows, [
    ['MUG-1', 'Blue Mug', 'http://localhost:3000/p/MUG-1', '15.00 EUR', 'in_stock'],
    ['MUG-2', 'Red Mug', 'http://localhost:3000/p/MUG-2', '12.99 EUR', 'out_of_stock'],
  ]);
});
