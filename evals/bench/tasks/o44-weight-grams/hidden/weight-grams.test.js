import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalog, loadCatalog } from '../../src/catalog/store.js';
import { createProduct, updateProduct } from '../../src/catalog/products.js';
import { importSupplierCsv } from '../../src/catalog/import.js';
import { feedRows } from '../../src/catalog/feed.js';
import { quoteShipping } from '../../src/shipping/quote.js';
import { labelFor } from '../../src/shipping/labels.js';
import { customsDeclaration } from '../../src/shipping/customs.js';

const at = (iso) => () => new Date(iso);

// Records as the admin and the import saved them before this change (production holds rows like these).
const OLD_RECORDS = [
  { sku: 'MUG-01', title: 'Stoneware mug', priceCents: 1490, weightKg: 0.42, hsCode: '691200', originCountry: 'PT', active: true },
  { sku: 'KTL-02', title: 'Enamel kettle', priceCents: 4900, weightKg: 1.35, hsCode: '732393', originCountry: 'PL', active: true },
  { sku: 'BRD-03', title: 'Oak cutting board', price: '29.90', weightKg: 2.1, hsCode: '441990', originCountry: 'DE', active: true },
  { sku: 'TEA-04', title: 'Loose leaf tea tin', priceCents: 890, weightKg: 0.125, hsCode: '090240', originCountry: 'LK', active: true },
];

const oldCatalog = () => createCatalog(OLD_RECORDS);

function withNewProducts(catalog = oldCatalog()) {
  createProduct(catalog, { sku: 'JAR-10', title: 'Honey jar', price: '7.50', weightKg: '0.35', hsCode: '701090', originCountry: 'GR' }, at('2026-11-06T09:00:00Z'));
  createProduct(catalog, { sku: 'BWL-11', title: 'Salad bowl', price: '24.00', weightKg: '0,553' }, at('2026-11-06T09:01:00Z'));
  createProduct(catalog, { sku: 'LID-12', title: 'Bowl lid', price: '6.00', weightKg: '0.341' }, at('2026-11-06T09:02:00Z'));
  return catalog;
}

test('the product form saves the weight as integer grams', () => {
  const catalog = withNewProducts();
  const raw = catalog.raw('JAR-10');
  assert.equal(raw.weightGrams, 350);
  assert.equal(raw.weightKg, undefined);
  assert.equal(catalog.raw('BWL-11').weightGrams, 553);
  assert.throws(() => createProduct(catalog, { sku: 'X-1', title: 'x', price: '1', weightKg: '0' }), /invalid weight/);
  assert.throws(() => createProduct(catalog, { sku: 'X-2', title: 'x', price: '1', weightKg: 'heavy' }), /invalid weight/);
});

test('the supplier import saves the weight as integer grams', () => {
  const catalog = oldCatalog();
  assert.deepEqual(importSupplierCsv(catalog, 'sku,title,price,weight_kg\nSOAP-07,Olive soap,6.50,0.11\nKTL-02,Enamel kettle 1.5 l,52.00,1.4\n'), { created: 1, updated: 1, skipped: [] });
  assert.equal(catalog.raw('SOAP-07').weightGrams, 110);
  assert.equal(catalog.raw('SOAP-07').weightKg, undefined);
  assert.equal(catalog.raw('KTL-02').weightGrams, 1400);
  assert.equal(labelFor(catalog, { id: 'P-7', to: 'Lyon', items: [{ sku: 'SOAP-07', qty: 2 }, { sku: 'KTL-02', qty: 1 }] }).weight, '1.620 kg');
  assert.deepEqual(feedRows(catalog).find((r) => r.id === 'KTL-02').shipping_weight, '1.4 kg');
});

test('shipping quotes work for old records, new records and a mix', () => {
  const catalog = withNewProducts();
  assert.deepEqual(quoteShipping(catalog, [{ sku: 'BRD-03', qty: 1 }], 'domestic'), { band: 'up to 5 kg', priceCents: 690 });
  assert.deepEqual(quoteShipping(catalog, [{ sku: 'JAR-10', qty: 2 }], 'eu'), { band: 'up to 2 kg', priceCents: 980 });
  assert.deepEqual(quoteShipping(catalog, [{ sku: 'MUG-01', qty: 2 }, { sku: 'JAR-10', qty: 3 }], 'domestic'), { band: 'up to 2 kg', priceCents: 490 });
  // 3 x 553 g + 341 g is exactly 2 kg: the parcel fits the first band.
  assert.deepEqual(quoteShipping(catalog, [{ sku: 'BWL-11', qty: 3 }, { sku: 'LID-12', qty: 1 }], 'domestic'), { band: 'up to 2 kg', priceCents: 490 });
});

test('carrier labels show the weight of old and new products', () => {
  const catalog = withNewProducts();
  assert.equal(labelFor(catalog, { id: 'P-1', to: 'Oslo', items: [{ sku: 'MUG-01', qty: 2 }, { sku: 'TEA-04', qty: 4 }] }).weight, '1.340 kg');
  assert.equal(labelFor(catalog, { id: 'P-2', to: 'Oslo', items: [{ sku: 'JAR-10', qty: 2 }] }).weight, '0.700 kg');
  assert.deepEqual(labelFor(catalog, { id: 'P-3', to: 'Bergen', items: [{ sku: 'MUG-01', qty: 1 }, { sku: 'JAR-10', qty: 1 }] }), {
    parcelId: 'P-3',
    to: 'Bergen',
    weight: '0.770 kg',
    contents: '1 x Stoneware mug, 1 x Honey jar',
  });
});

test('customs declarations show the net mass of old and new products', () => {
  const catalog = withNewProducts();
  const cn23 = customsDeclaration(catalog, [{ sku: 'TEA-04', qty: 3 }, { sku: 'JAR-10', qty: 2 }, { sku: 'BRD-03', qty: 1 }]);
  assert.deepEqual(cn23.lines.map((l) => l.netMassKg), [0.375, 0.7, 2.1]);
  assert.equal(cn23.totalNetMassKg, 3.175);
  assert.equal(cn23.totalValueCents, 3 * 890 + 2 * 750 + 2990);
  assert.equal(cn23.lines[1].origin, 'GR');
});

test('the merchant feed shows the weight of old and new products', () => {
  const catalog = withNewProducts();
  const weights = Object.fromEntries(feedRows(catalog).map((r) => [r.id, r.shipping_weight]));
  assert.deepEqual(weights, {
    'BRD-03': '2.1 kg',
    'BWL-11': '0.553 kg',
    'JAR-10': '0.35 kg',
    'KTL-02': '1.35 kg',
    'LID-12': '0.341 kg',
    'MUG-01': '0.42 kg',
    'TEA-04': '0.125 kg',
  });
});

test('editing an old record keeps or updates its weight', () => {
  const catalog = oldCatalog();
  updateProduct(catalog, 'MUG-01', { title: 'Large stoneware mug' }, at('2026-11-06T10:00:00Z'));
  assert.equal(labelFor(catalog, { id: 'P-4', to: 'Riga', items: [{ sku: 'MUG-01', qty: 1 }] }).weight, '0.420 kg');
  updateProduct(catalog, 'KTL-02', { weightKg: '1.4' }, at('2026-11-06T10:01:00Z'));
  assert.equal(catalog.raw('KTL-02').weightGrams, 1400);
  assert.equal(labelFor(catalog, { id: 'P-5', to: 'Riga', items: [{ sku: 'KTL-02', qty: 1 }] }).weight, '1.400 kg');
  assert.equal(customsDeclaration(catalog, [{ sku: 'KTL-02', qty: 2 }]).totalNetMassKg, 2.8);
  assert.equal(feedRows(catalog).find((r) => r.id === 'KTL-02').shipping_weight, '1.4 kg');
});

test('the saved catalog in data/products.json still ships', () => {
  const catalog = loadCatalog();
  assert.deepEqual(quoteShipping(catalog, [{ sku: 'PAN-05', qty: 1 }, { sku: 'KTL-02', qty: 1 }], 'world'), { band: 'up to 5 kg', priceCents: 2070 });
  assert.equal(labelFor(catalog, { id: 'P-6', to: 'Turin', items: [{ sku: 'PAN-05', qty: 1 }, { sku: 'TEA-04', qty: 2 }] }).weight, '3.850 kg');
  assert.equal(customsDeclaration(catalog, [{ sku: 'BRD-03', qty: 2 }]).totalNetMassKg, 4.2);
  assert.equal(feedRows(catalog).find((r) => r.id === 'PAN-05').shipping_weight, '3.6 kg');
});
