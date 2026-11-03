import test from 'node:test';
import assert from 'node:assert/strict';
import { openCatalog, UnknownSku } from '../src/inventory/catalog.js';
import { memoryStorage } from '../src/inventory/storage.js';
import { connectSearchIndex } from '../src/inventory/search-index.js';
import { demoCatalogJson, demoProducts } from '../src/inventory/seed.js';

const now = () => new Date('2026-10-14T02:00:00Z');

test('stock changes are saved and reported to listeners', () => {
  const storage = memoryStorage(demoCatalogJson(10));
  const catalog = openCatalog(storage, { now });
  const changes = [];
  catalog.onChange((c) => changes.push(c));
  catalog.setStock('SKU-000003', 5);
  assert.equal(catalog.get('SKU-000003')?.stock, 5);
  assert.deepEqual(changes, [{ type: 'stock', sku: 'SKU-000003', before: 74, after: 5, at: '2026-10-14T02:00:00.000Z' }]);
  assert.equal(openCatalog(storage).get('SKU-000003')?.stock, 5);
});

test('invalid stock and unknown skus are rejected', () => {
  const catalog = openCatalog(memoryStorage(demoCatalogJson(10)), { now });
  assert.throws(() => catalog.setStock('SKU-000003', -1), RangeError);
  assert.throws(() => catalog.setStock('SKU-000003', 2.5), RangeError);
  assert.throws(() => catalog.setStock('NOPE', 1), UnknownSku);
});

test('search hides products that run out and shows them when stock is back', () => {
  const catalog = openCatalog(memoryStorage(demoCatalogJson(10)), { now });
  const calls = [];
  connectSearchIndex(catalog, { setAvailable: (sku, available) => calls.push([sku, available]) });
  catalog.setStock('SKU-000003', 0);
  catalog.setStock('SKU-000003', 0);
  catalog.setStock('SKU-000003', 4);
  catalog.setStock('SKU-000004', 6);
  assert.deepEqual(calls, [['SKU-000003', false], ['SKU-000003', true]]);
});

test('demo data has unique skus', () => {
  assert.equal(new Set(demoProducts(1000).map((p) => p.sku)).size, 1000);
});
