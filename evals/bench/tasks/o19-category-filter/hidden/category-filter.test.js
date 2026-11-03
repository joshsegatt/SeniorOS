import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogDb } from '../../src/catalog/db.js';
import { createCategory, moveCategory, renameCategory } from '../../src/catalog/categories.js';
import { createProduct } from '../../src/catalog/products.js';
import { productsInCategory } from '../../src/catalog/browse.js';
import { breadcrumbs } from '../../src/catalog/breadcrumbs.js';
import { merchantFeed } from '../../src/catalog/feed.js';

function shop() {
  const db = createCatalogDb();
  const outdoor = createCategory(db, { name: 'Outdoor' });
  const bbq = createCategory(db, { name: 'BBQ', parentId: outdoor.id });
  const gas = createCategory(db, { name: 'Gas', parentId: bbq.id });
  const kitchen = createCategory(db, { name: 'Kitchen' });
  createProduct(db, { sku: 'GR-100', title: 'Kettle grill', price: 129, categoryId: bbq.id });
  createProduct(db, { sku: 'GR-101', title: 'Charcoal smoker', price: 349, categoryId: bbq.id });
  createProduct(db, { sku: 'GG-200', title: 'Gas grill 3 burner', price: 299, categoryId: gas.id });
  return { db, outdoor, bbq, gas, kitchen };
}

const skus = (products) => products.map((p) => p.sku).sort();
const feedType = (db, sku) => merchantFeed(db).find((r) => r.id === sku)?.product_type;

test('the reported case: the category page works after a category is renamed', () => {
  const { db, bbq } = shop();
  renameCategory(db, bbq.id, 'Grills');
  assert.deepEqual(skus(productsInCategory(db, 'Outdoor > Grills')), ['GG-200', 'GR-100', 'GR-101']);
  assert.deepEqual(skus(productsInCategory(db, 'Outdoor > Grills > Gas')), ['GG-200']);
  assert.deepEqual(productsInCategory(db, 'Outdoor > BBQ'), []);
});

test('product breadcrumbs follow a rename', () => {
  const { db, bbq } = shop();
  renameCategory(db, bbq.id, 'Grills');
  assert.deepEqual(breadcrumbs(db, 'GR-100').map((b) => b.path), ['Outdoor', 'Outdoor > Grills']);
  assert.deepEqual(breadcrumbs(db, 'GG-200').map((b) => b.name), ['Outdoor', 'Grills', 'Gas']);
});

test('the merchant feed follows a rename', () => {
  const { db, bbq } = shop();
  renameCategory(db, bbq.id, 'Grills');
  assert.equal(feedType(db, 'GR-101'), 'Outdoor > Grills');
  assert.equal(feedType(db, 'GG-200'), 'Outdoor > Grills > Gas');
});

test('renaming a parent category updates everything below it', () => {
  const { db, outdoor } = shop();
  renameCategory(db, outdoor.id, 'Garden');
  assert.deepEqual(skus(productsInCategory(db, 'Garden > BBQ > Gas')), ['GG-200']);
  assert.deepEqual(breadcrumbs(db, 'GG-200').map((b) => b.name), ['Garden', 'BBQ', 'Gas']);
  assert.equal(feedType(db, 'GR-100'), 'Garden > BBQ');
});

test('moving a category moves its products in the shop, breadcrumbs and feed', () => {
  const { db, bbq, kitchen } = shop();
  moveCategory(db, bbq.id, kitchen.id);
  assert.deepEqual(skus(productsInCategory(db, 'Kitchen')), ['GG-200', 'GR-100', 'GR-101']);
  assert.deepEqual(productsInCategory(db, 'Outdoor'), []);
  assert.deepEqual(breadcrumbs(db, 'GG-200').map((b) => b.path), ['Kitchen', 'Kitchen > BBQ', 'Kitchen > BBQ > Gas']);
  assert.equal(feedType(db, 'GR-100'), 'Kitchen > BBQ');
});

test('products added after a rename and other categories are unaffected', () => {
  const { db, bbq, kitchen } = shop();
  renameCategory(db, bbq.id, 'Grills');
  createProduct(db, { sku: 'GR-140', title: 'Grill gloves', price: 24.9, categoryId: bbq.id });
  createProduct(db, { sku: 'CW-400', title: 'Frying pan', price: 39, categoryId: kitchen.id });
  assert.deepEqual(skus(productsInCategory(db, 'Outdoor')), ['GG-200', 'GR-100', 'GR-101', 'GR-140']);
  assert.deepEqual(skus(productsInCategory(db, 'Kitchen')), ['CW-400']);
});
