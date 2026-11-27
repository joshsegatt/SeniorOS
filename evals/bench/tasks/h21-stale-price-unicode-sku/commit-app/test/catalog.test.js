import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCatalog } from '../src/catalog/catalog.js';
import { canonicalSku } from '../src/catalog/sku.js';
import { parseFeed } from '../src/import/feed.js';
import { FEED } from './helpers.js';

test('canonical SKU ignores case and surrounding whitespace', () => {
  assert.equal(canonicalSku('  esp-01 '), 'ESP-01');
  assert.throws(() => canonicalSku('   '), TypeError);
});

test('catalog keeps the supplier spelling and finds products case-insensitively', () => {
  const c = createCatalog();
  c.upsert({ sku: ' moulin-01 ', name: 'Moulin', netCents: 4900, vatPermille: 81 });
  assert.equal(c.get('MOULIN-01').sku, 'moulin-01');
  assert.equal(c.setPrice('Moulin-01', 4500).netCents, 4500);
  assert.equal(c.get('moulin-01').netCents, 4500);
  assert.equal(c.all().length, 1);
});

test('feed parsing', () => {
  const rows = parseFeed(FEED);
  assert.equal(rows.length, 7);
  assert.deepEqual(rows[0], { sku: 'ESP-01', name: 'Espresso Bohnen 1kg', netCents: 2490, vatPermille: 26 });
  assert.throws(() => parseFeed('sku,name\nA,B'), /header/);
});
