import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { importProducts } from '../src/importer.js';
import { Catalog } from '../src/catalog.js';

test('imports the sample supplier file', async () => {
  const text = await readFile(new URL('../data/sample-supplier.csv', import.meta.url), 'utf8');
  const catalog = new Catalog();
  const result = importProducts(text, { catalog });

  assert.equal(result.imported, 3);
  assert.equal(catalog.size, 3);
  assert.deepEqual(catalog.get('S-200'), {
    sku: 'S-200',
    name: 'Hand saw',
    description: '500 mm, "universal" teeth',
    priceCents: 1900,
    stock: 0,
  });
  assert.equal(catalog.get('H-101').priceCents, 950);
});

test('a later import replaces the product', () => {
  const catalog = new Catalog();
  importProducts('sku,name,description,price,stock\nX-1,Old,,1.00,1\n', { catalog });
  importProducts('sku,name,description,price,stock\nX-1,New,,2.00,3\n', { catalog });
  assert.equal(catalog.get('X-1').name, 'New');
  assert.equal(catalog.get('X-1').priceCents, 200);
});
