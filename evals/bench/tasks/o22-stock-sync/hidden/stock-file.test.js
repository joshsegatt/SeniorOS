import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openCatalog } from '../../src/inventory/catalog.js';
import { memoryStorage } from '../../src/inventory/storage.js';
import { connectSearchIndex } from '../../src/inventory/search-index.js';
import { demoCatalogJson } from '../../src/inventory/seed.js';
import { applyStockFile } from '../../src/inventory/stock-file.js';

const sample = () => readFileSync(new URL('../../data/stock-2026-10-14.csv', import.meta.url), 'utf8');

/** Storage that counts whole-catalog writes; a production catalog document is ~4 MB. */
function countingStorage(initial) {
  const inner = memoryStorage(initial);
  const s = {
    writes: 0,
    read: () => inner.read(),
    write(text) {
      s.writes += 1;
      if (s.writes > 50) throw new Error('test: more than 50 writes of the whole catalog document');
      inner.write(text);
    },
  };
  return s;
}

test('the sample file updates known skus and reports unknown ones', async () => {
  const storage = memoryStorage(demoCatalogJson(200));
  const catalog = openCatalog(storage);
  const result = await applyStockFile(catalog, sample());
  assert.equal(result.updated, 7);
  assert.deepEqual([...result.unknown].sort(), ['OLD-4471', 'SKU-999999']);
  assert.equal(catalog.get('SKU-000017')?.stock, 250);
  assert.equal(catalog.get('SKU-000002')?.stock, 0);
  assert.equal(catalog.get('SKU-000003')?.stock, 74);
  const reopened = openCatalog(storage);
  assert.equal(reopened.get('SKU-000199')?.stock, 88, 'stock levels are saved');
  assert.equal(reopened.get('SKU-000001')?.stock, 12);
});

test('storefront search hears about products that ran out or came back', async () => {
  const catalog = openCatalog(memoryStorage(demoCatalogJson(200)));
  const calls = [];
  connectSearchIndex(catalog, { setAvailable: (sku, available) => calls.push(`${sku}:${available}`) });
  await applyStockFile(catalog, sample());
  assert.deepEqual(calls.sort(), ['SKU-000001:true', 'SKU-000002:false']);
});

test('CRLF files work', async () => {
  const catalog = openCatalog(memoryStorage(demoCatalogJson(20)));
  const result = await applyStockFile(catalog, 'sku,qty\r\nSKU-000005,9\r\nSKU-000006,10\r\n');
  assert.equal(result.updated, 2);
  assert.equal(catalog.get('SKU-000006')?.stock, 10);
});

test('a nightly file the size of production is applied without rewriting the catalog per line', async () => {
  const storage = countingStorage(demoCatalogJson(42_000));
  const catalog = openCatalog(storage);
  const changes = [];
  catalog.onChange((c) => changes.push(c));
  const lines = ['sku,qty'];
  for (let i = 0; i < 6_500; i += 1) {
    const n = 1 + i * 6;
    lines.push(`SKU-${String(n).padStart(6, '0')},${(((n - 1) * 37) % 120) + 1}`);
  }
  lines.push('SKU-900001,5');
  const result = await applyStockFile(catalog, lines.join('\n') + '\n');
  assert.equal(result.updated, 6_500);
  assert.deepEqual([...result.unknown], ['SKU-900001']);
  assert.ok(storage.writes >= 1 && storage.writes <= 10, `${storage.writes} writes of the whole catalog document`);
  assert.equal(changes.filter((c) => c.type === 'stock').length, 6_500, 'listeners hear about every stock change');
  const reopened = openCatalog(memoryStorage(storage.read()));
  assert.equal(reopened.get('SKU-038995')?.stock, ((38_994 * 37) % 120) + 1);
});
