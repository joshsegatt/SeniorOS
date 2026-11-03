import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryDb } from '../../src/db/memory.js';
import { seedCollections } from '../../src/db/seed.js';
import { buildReorderReport } from '../../src/purchasing/reorder.js';

/** The real client, counting every call: in production each one is a round trip to the database service. */
function countingDb(collections) {
  const db = createMemoryDb(collections);
  const counter = { calls: 0 };
  const wrapped = {
    find: (...args) => { counter.calls += 1; return db.find(...args); },
    findOne: (...args) => { counter.calls += 1; return db.findOne(...args); },
  };
  return { db: wrapped, counter };
}

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

test('lists active products at or below their reorder point with the supplier contact', async () => {
  const { db } = countingDb({
    products: [
      { sku: 'B-2', name: 'Bowl', active: true, supplierId: 's2', reorderPoint: 4 },
      { sku: 'A-1', name: 'Mug', active: true, supplierId: 's1', reorderPoint: 5 },
      { sku: 'A-0', name: 'Cup', active: true, supplierId: 's1', reorderPoint: 5 },
      { sku: 'A-9', name: 'Old mug', active: false, supplierId: 's1', reorderPoint: 5 },
      { sku: 'C-3', name: 'Teapot', active: true, supplierId: 's2', reorderPoint: 2 },
      { sku: 'D-4', name: 'Never stocked', active: true, supplierId: 's1', reorderPoint: 1 },
    ],
    stock: [{ sku: 'B-2', onHand: 4 }, { sku: 'A-1', onHand: 6 }, { sku: 'A-0', onHand: 5 }, { sku: 'A-9', onHand: 0 }, { sku: 'C-3', onHand: 3 }],
    suppliers: [{ id: 's1', name: 'Zest Ceramics', email: 'orders@zest.example' }, { id: 's2', name: 'Clayworks', email: 'hi@clay.example' }],
  });
  const rows = await buildReorderReport(db);
  assert.deepEqual(rows, [
    { sku: 'B-2', name: 'Bowl', onHand: 4, reorderPoint: 4, supplierName: 'Clayworks', supplierEmail: 'hi@clay.example' },
    { sku: 'A-0', name: 'Cup', onHand: 5, reorderPoint: 5, supplierName: 'Zest Ceramics', supplierEmail: 'orders@zest.example' },
    { sku: 'D-4', name: 'Never stocked', onHand: 0, reorderPoint: 1, supplierName: 'Zest Ceramics', supplierEmail: 'orders@zest.example' },
  ]);
});

test('the report over the production-size catalog takes a handful of database calls, not one per product', async () => {
  const collections = seedCollections();
  const { db, counter } = countingDb(collections);
  const rows = await buildReorderReport(db);

  const stock = new Map(collections.stock.map((s) => [s.sku, s.onHand]));
  const suppliers = new Map(collections.suppliers.map((s) => [s.id, s]));
  const expected = collections.products
    .filter((p) => p.active && (stock.get(p.sku) ?? 0) <= p.reorderPoint)
    .map((p) => ({ sku: p.sku, name: p.name, onHand: stock.get(p.sku) ?? 0, reorderPoint: p.reorderPoint, supplierName: suppliers.get(p.supplierId).name, supplierEmail: suppliers.get(p.supplierId).email }))
    .sort((a, b) => cmp(a.supplierName, b.supplierName) || cmp(a.sku, b.sku));
  assert.ok(expected.length > 1000);
  assert.equal(rows.length, expected.length);
  assert.deepEqual(rows, expected);
  assert.ok(counter.calls <= 10, `the report made ${counter.calls} database calls for ${collections.products.length} products`);
});
