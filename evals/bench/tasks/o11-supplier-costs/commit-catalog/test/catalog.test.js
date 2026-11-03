import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalog, normalizeSku } from '../src/catalog/catalog.js';
import { demoProducts } from '../src/catalog/seed.js';

const rows = () => [
  { sku: 'mug-1', name: 'Mug', category: 'mugs', priceCents: 1000, costCents: null },
  { sku: 'MUG-2', name: 'Big mug', category: 'mugs', priceCents: 2000, costCents: 500 },
  { sku: 'TEA-1', name: 'Teapot', category: 'teapots', priceCents: 3000, costCents: null },
];

test('skus are matched trimmed and upper-case', () => {
  assert.equal(normalizeSku(' mug-1 '), 'MUG-1');
  const catalog = createCatalog(rows());
  assert.equal(catalog.findBySku(' mug-1')?.name, 'Mug');
  assert.equal(catalog.findBySku('nope'), null);
});

test('category stats follow updates', () => {
  const catalog = createCatalog(rows());
  assert.deepEqual(catalog.categoryStats('mugs'), { products: 2, withCost: 1, avgMarginPct: 75 });
  catalog.update('MUG-1', { costCents: 600 });
  assert.deepEqual(catalog.categoryStats('mugs'), { products: 2, withCost: 2, avgMarginPct: 57.5 });
  assert.deepEqual(catalog.categoryStats('teapots'), { products: 1, withCost: 0, avgMarginPct: null });
  assert.equal(catalog.categoryStats('nope'), null);
  assert.throws(() => catalog.update('NOPE', { costCents: 1 }), /unknown product/);
});

test('demo data has unique skus', () => {
  const products = demoProducts(800);
  assert.equal(new Set(products.map((p) => p.sku)).size, 800);
});
