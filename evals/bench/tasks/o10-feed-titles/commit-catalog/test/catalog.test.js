import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalog } from '../src/catalog/store.js';
import { createProduct } from '../src/catalog/admin.js';
import { importSupplierFeed } from '../src/catalog/feed-import.js';
import { renderProductCard } from '../src/storefront/card.js';
import { searchProducts } from '../src/storefront/search.js';
import { invoiceText } from '../src/orders/invoice.js';
import { getProductJson } from '../src/api/products.js';

test('admin products are validated and stored', () => {
  const catalog = createCatalog();
  const p = createProduct(catalog, { sku: ' mug-1 ', name: ' Blue Mug ', priceCents: 1290 });
  assert.deepEqual(p, { sku: 'MUG-1', name: 'Blue Mug', priceCents: 1290, source: 'admin' });
  assert.throws(() => createProduct(catalog, { sku: 'MUG-1', name: 'Again', priceCents: 1 }), /already exists/);
  assert.throws(() => createProduct(catalog, { sku: 'X', name: '', priceCents: 1 }), /name is required/);
});

test('the card escapes markup in names', () => {
  const html = renderProductCard({ sku: 'T-1', name: 'Mug <b>XL</b> "Deluxe"', priceCents: 990, source: 'admin' });
  assert.match(html, /<h3>Mug &lt;b&gt;XL&lt;\/b&gt; &quot;Deluxe&quot;<\/h3>/);
  assert.match(html, /€9\.90/);
});

test('the feed import creates and updates feed products and never touches admin ones', () => {
  const catalog = createCatalog();
  createProduct(catalog, { sku: 'MUG-1', name: 'Blue Mug', priceCents: 1290 });
  const first = importSupplierFeed(catalog, [
    { ref: 'mug-1', title: 'Supplier Mug', price: '9.99' },
    { ref: 'tea-7', title: 'Green Tea 100g', price: '4.50' },
    { ref: '', title: 'No ref', price: '1.00' },
  ]);
  assert.deepEqual(first, { created: 1, updated: 0, skipped: 2 });
  assert.equal(catalog.get('MUG-1').name, 'Blue Mug');
  assert.equal(catalog.get('TEA-7').priceCents, 450);
  const second = importSupplierFeed(catalog, [{ ref: 'TEA-7', title: 'Green Tea 100g', price: '4.75' }]);
  assert.deepEqual(second, { created: 0, updated: 1, skipped: 0 });
  assert.equal(catalog.get('TEA-7').priceCents, 475);
});

test('search matches every word, case-insensitively', () => {
  const catalog = createCatalog();
  createProduct(catalog, { sku: 'A', name: 'Blue Mug', priceCents: 100 });
  createProduct(catalog, { sku: 'B', name: 'Blue Teapot', priceCents: 100 });
  assert.deepEqual(searchProducts(catalog, 'blue').map((p) => p.sku), ['A', 'B']);
  assert.deepEqual(searchProducts(catalog, 'MUG blue').map((p) => p.sku), ['A']);
  assert.deepEqual(searchProducts(catalog, '  '), []);
});

test('invoice text and product JSON', () => {
  const catalog = createCatalog();
  createProduct(catalog, { sku: 'A', name: 'Blue Mug', priceCents: 1290 });
  const text = invoiceText({ id: 'INV-1', lines: [{ sku: 'A', qty: 2 }] }, catalog);
  assert.match(text, /2 x Blue Mug/);
  assert.match(text, /25\.80 EUR$/);
  assert.deepEqual(getProductJson(catalog, 'a').body, { sku: 'A', name: 'Blue Mug', price: { amount: 1290, currency: 'EUR' } });
  assert.equal(getProductJson(catalog, 'zzz').status, 404);
});
