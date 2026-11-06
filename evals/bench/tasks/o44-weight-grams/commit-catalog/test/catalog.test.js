import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalog, loadCatalog } from '../src/catalog/store.js';
import { createProduct, updateProduct } from '../src/catalog/products.js';
import { importSupplierCsv } from '../src/catalog/import.js';
import { feedRows } from '../src/catalog/feed.js';
import { searchProducts } from '../src/catalog/search.js';
import { quoteShipping } from '../src/shipping/quote.js';
import { labelFor } from '../src/shipping/labels.js';
import { customsDeclaration } from '../src/shipping/customs.js';

const at = (iso) => () => new Date(iso);

function shop() {
  const catalog = createCatalog();
  createProduct(catalog, { sku: 'mug-01', title: 'Stoneware mug', price: '14.90', weightKg: '0.42', hsCode: '691200', originCountry: 'pt' }, at('2026-10-01T09:00:00Z'));
  createProduct(catalog, { sku: 'KTL-02', title: 'Enamel kettle', price: '49,00', weightKg: '1,35' }, at('2026-10-01T09:05:00Z'));
  return catalog;
}

test('the product form validates and saves', () => {
  const catalog = shop();
  assert.equal(catalog.get('MUG-01').priceCents, 1490);
  assert.equal(catalog.get('MUG-01').originCountry, 'PT');
  assert.throws(() => createProduct(catalog, { sku: 'MUG-01', title: 'x', price: '1', weightKg: '1' }), /already exists/);
  assert.throws(() => createProduct(catalog, { sku: 'X-1', title: 'x', price: '1', weightKg: '0' }), /invalid weight/);
  assert.throws(() => createProduct(catalog, { sku: 'X-1', title: 'x', price: 'free', weightKg: '1' }), /invalid price/);
  updateProduct(catalog, 'MUG-01', { title: 'Large stoneware mug', price: '16.50' });
  assert.equal(catalog.get('MUG-01').title, 'Large stoneware mug');
  assert.equal(catalog.get('MUG-01').priceCents, 1650);
});

test('shipping quotes use the weight band', () => {
  const catalog = shop();
  assert.deepEqual(quoteShipping(catalog, [{ sku: 'MUG-01', qty: 2 }], 'domestic'), { band: 'up to 2 kg', priceCents: 490 });
  assert.deepEqual(quoteShipping(catalog, [{ sku: 'MUG-01', qty: 2 }, { sku: 'KTL-02', qty: 1 }], 'eu'), { band: 'up to 5 kg', priceCents: 1380 });
  assert.throws(() => quoteShipping(catalog, [{ sku: 'NOPE', qty: 1 }], 'eu'), /unknown sku/);
});

test('labels and customs declarations', () => {
  const catalog = shop();
  const items = [{ sku: 'MUG-01', qty: 3 }, { sku: 'KTL-02', qty: 1 }];
  assert.deepEqual(labelFor(catalog, { id: 'P-1', to: 'Oslo', items }), { parcelId: 'P-1', to: 'Oslo', weight: '2.610 kg', contents: '3 x Stoneware mug, 1 x Enamel kettle' });
  const cn23 = customsDeclaration(catalog, items);
  assert.equal(cn23.lines[0].netMassKg, 1.26);
  assert.equal(cn23.totalNetMassKg, 2.61);
  assert.equal(cn23.totalValueCents, 3 * 1490 + 4900);
});

test('feed, search and the supplier import', () => {
  const catalog = shop();
  assert.deepEqual(importSupplierCsv(catalog, 'sku,title,price,weight_kg\nSOAP-07,Olive soap,6.50,0.11\nKTL-02,Enamel kettle 1.5 l,52.00,1.4\nBAD-1,,1.00,1\n'), { created: 1, updated: 1, skipped: ['BAD-1'] });
  assert.deepEqual(feedRows(catalog).map((r) => r.id), ['KTL-02', 'MUG-01', 'SOAP-07']);
  assert.deepEqual(feedRows(catalog)[0], { id: 'KTL-02', title: 'Enamel kettle 1.5 l', price: '52.00 EUR', shipping_weight: '1.4 kg' });
  assert.deepEqual(searchProducts(catalog, 'enamel'), ['KTL-02']);
});

test('the saved catalog loads, including records saved before priceCents', () => {
  const catalog = loadCatalog();
  assert.equal(catalog.get('BRD-03').priceCents, 2990);
  assert.equal(catalog.all().length, 6);
  assert.equal(feedRows(catalog).length, 5);
});
