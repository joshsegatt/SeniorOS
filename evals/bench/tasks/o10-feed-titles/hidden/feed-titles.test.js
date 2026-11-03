import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalog } from '../../src/catalog/store.js';
import { createProduct } from '../../src/catalog/admin.js';
import { importSupplierFeed } from '../../src/catalog/feed-import.js';
import { renderProductCard } from '../../src/storefront/card.js';
import { searchProducts } from '../../src/storefront/search.js';
import { invoiceText } from '../../src/orders/invoice.js';
import { getProductJson } from '../../src/api/products.js';

function catalogWithFeed() {
  const catalog = createCatalog();
  importSupplierFeed(catalog, [
    { ref: 'SP-1', title: 'Salt & Pepper Set', price: '14.90' },
    { ref: 'MG-2', title: 'Mug <b>XL</b> "Deluxe"', price: '9.90' },
    { ref: 'TP-3', title: "Tom's Teapot", price: '24.00' },
  ]);
  createProduct(catalog, { sku: 'FC-9', name: 'Fish & Chips Plate', priceCents: 1800 });
  return catalog;
}

test('the reported case: an imported title is escaped exactly once on the storefront card', () => {
  const html = renderProductCard(catalogWithFeed().get('SP-1'));
  assert.match(html, /<h3>Salt &amp; Pepper Set<\/h3>/);
  assert.doesNotMatch(html, /&amp;amp;/);
});

test('markup in titles is still escaped on the card, for imported and back-office products', () => {
  const catalog = catalogWithFeed();
  assert.match(renderProductCard(catalog.get('MG-2')), /<h3>Mug &lt;b&gt;XL&lt;\/b&gt; &quot;Deluxe&quot;<\/h3>/);
  assert.match(renderProductCard(catalog.get('TP-3')), /<h3>Tom&#39;s Teapot<\/h3>/);
  assert.match(renderProductCard(catalog.get('FC-9')), /<h3>Fish &amp; Chips Plate<\/h3>/);
  const evil = renderProductCard({ sku: 'X', name: '<script>alert(1)</script>', priceCents: 100, source: 'admin' });
  assert.doesNotMatch(evil, /<script>/);
});

test('customers can search imported products by what the name says', () => {
  const catalog = catalogWithFeed();
  assert.deepEqual(searchProducts(catalog, 'salt & pepper').map((p) => p.sku), ['SP-1']);
  assert.deepEqual(searchProducts(catalog, "tom's").map((p) => p.sku), ['TP-3']);
  assert.deepEqual(searchProducts(catalog, 'amp').map((p) => p.sku), []);
});

test('invoices print imported product names as plain text', () => {
  const text = invoiceText({ id: 'INV-7', lines: [{ sku: 'SP-1', qty: 1 }, { sku: 'TP-3', qty: 1 }] }, catalogWithFeed());
  assert.match(text, /1 x Salt & Pepper Set /);
  assert.match(text, /1 x Tom's Teapot /);
  assert.doesNotMatch(text, /&amp;|&#39;/);
});

test('the mobile app gets the real product name', () => {
  const catalog = catalogWithFeed();
  assert.equal(getProductJson(catalog, 'SP-1').body.name, 'Salt & Pepper Set');
  assert.equal(getProductJson(catalog, 'MG-2').body.name, 'Mug <b>XL</b> "Deluxe"');
});

test('re-running the feed keeps the names stable', () => {
  const catalog = catalogWithFeed();
  importSupplierFeed(catalog, [{ ref: 'SP-1', title: 'Salt & Pepper Set', price: '15.90' }]);
  assert.equal(getProductJson(catalog, 'SP-1').body.name, 'Salt & Pepper Set');
  assert.match(renderProductCard(catalog.get('SP-1')), /<h3>Salt &amp; Pepper Set<\/h3>/);
});
