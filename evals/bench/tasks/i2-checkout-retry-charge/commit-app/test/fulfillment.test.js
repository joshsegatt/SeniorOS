import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planParcels } from '../src/fulfillment.js';
import { createCatalog } from '../src/catalog.js';

const catalog = createCatalog();
const line = (sku, qty) => ({ item: catalog.get(sku), qty });

test('small orders fit in one parcel', () => {
  assert.deepEqual(planParcels([line('BOOK-1', 2), line('LAMP-2', 1)]), [
    { skus: ['BOOK-1', 'BOOK-1', 'LAMP-2'], grams: 3600 },
  ]);
});

test('parcels never exceed 30 kg', () => {
  const parcels = planParcels([line('BENCH-3', 3)]);
  assert.equal(parcels.length, 3);
  assert.ok(parcels.every((parcel) => parcel.grams <= 30000));
});
