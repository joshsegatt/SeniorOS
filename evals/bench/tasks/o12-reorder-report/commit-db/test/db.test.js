import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryDb } from '../src/db/memory.js';
import { seedCollections } from '../src/db/seed.js';
import { getProductsBySkus, listActiveProducts } from '../src/catalog/products.js';
import { getStockLevel } from '../src/inventory/stock.js';
import { getSupplier } from '../src/purchasing/suppliers.js';
import { productPage } from '../src/storefront/product-page.js';

const small = () => createMemoryDb({
  products: [
    { sku: 'A', name: 'Mug', active: true, supplierId: 's1', reorderPoint: 5 },
    { sku: 'B', name: 'Old mug', active: false, supplierId: 's1', reorderPoint: 5 },
    { sku: 'C', name: 'Teapot', active: true, supplierId: 's2', reorderPoint: 2 },
  ],
  stock: [{ sku: 'A', onHand: 3 }, { sku: 'B', onHand: 0 }],
  suppliers: [{ id: 's1', name: 'Clayworks', email: 'orders@clay.example' }, { id: 's2', name: 'Teaco', email: 'hi@teaco.example' }],
});

test('filters by equality and $in', async () => {
  const db = small();
  assert.deepEqual((await listActiveProducts(db)).map((p) => p.sku), ['A', 'C']);
  assert.deepEqual((await getProductsBySkus(db, ['C', 'B', 'Z'])).map((p) => p.sku), ['B', 'C']);
  assert.deepEqual(await getProductsBySkus(db, []), []);
  assert.equal((await db.findOne('suppliers', { id: 's2' }))?.name, 'Teaco');
});

test('stock levels default to zero', async () => {
  const db = small();
  assert.equal(await getStockLevel(db, 'A'), 3);
  assert.equal(await getStockLevel(db, 'C'), 0);
  assert.equal((await getSupplier(db, 's1'))?.email, 'orders@clay.example');
  assert.equal(await getSupplier(db, 'nope'), null);
});

test('product page', async () => {
  const db = small();
  assert.deepEqual(await productPage(db, 'A'), { sku: 'A', name: 'Mug', inStock: true, lowStock: true });
  assert.deepEqual(await productPage(db, 'C'), { sku: 'C', name: 'Teapot', inStock: false, lowStock: false });
  assert.equal(await productPage(db, 'B'), null);
});

test('seed data is consistent', () => {
  const { products, suppliers } = seedCollections({ products: 300, suppliers: 20 });
  const ids = new Set(suppliers.map((s) => s.id));
  assert.ok(products.every((p) => ids.has(p.supplierId)));
  assert.equal(new Set(products.map((p) => p.sku)).size, 300);
});
