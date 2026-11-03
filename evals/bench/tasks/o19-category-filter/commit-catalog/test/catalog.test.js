import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogDb } from '../src/catalog/db.js';
import { categoryPath, createCategory, moveCategory, renameCategory } from '../src/catalog/categories.js';
import { adminProductsIn, createProduct, updateProduct } from '../src/catalog/products.js';
import { productsInCategory } from '../src/catalog/browse.js';
import { breadcrumbs } from '../src/catalog/breadcrumbs.js';
import { merchantFeed } from '../src/catalog/feed.js';

function shop() {
  const db = createCatalogDb();
  const outdoor = createCategory(db, { name: 'Outdoor' });
  const furniture = createCategory(db, { name: 'Furniture', parentId: outdoor.id });
  const tools = createCategory(db, { name: 'Tools' });
  createProduct(db, { sku: 'ch-1', title: 'Deck chair', price: 49, categoryId: furniture.id });
  createProduct(db, { sku: 'tb-1', title: 'Bistro table', price: 89.5, categoryId: furniture.id });
  createProduct(db, { sku: 'dr-1', title: 'Drill', price: 120, categoryId: tools.id });
  return { db, outdoor, furniture, tools };
}

test('category paths', () => {
  const { db, furniture } = shop();
  assert.equal(categoryPath(db, furniture.id), 'Outdoor > Furniture');
  assert.throws(() => createCategory(db, { name: 'A > B' }), />/);
});

test('a category page lists its products and those of subcategories', () => {
  const { db } = shop();
  assert.deepEqual(productsInCategory(db, 'Outdoor > Furniture').map((p) => p.sku), ['TB-1', 'CH-1']);
  assert.deepEqual(productsInCategory(db, 'Outdoor').map((p) => p.sku), ['TB-1', 'CH-1']);
  assert.deepEqual(productsInCategory(db, 'Out'), []);
});

test('inactive products are hidden', () => {
  const { db } = shop();
  updateProduct(db, 'CH-1', { active: false });
  assert.deepEqual(productsInCategory(db, 'Outdoor').map((p) => p.sku), ['TB-1']);
});

test('moving a product to another category', () => {
  const { db, tools } = shop();
  updateProduct(db, 'CH-1', { categoryId: tools.id });
  assert.deepEqual(productsInCategory(db, 'Tools').map((p) => p.sku), ['CH-1', 'DR-1']);
  assert.deepEqual(breadcrumbs(db, 'CH-1'), [{ name: 'Tools', path: 'Tools' }]);
});

test('admin rename and move', () => {
  const { db, furniture, tools, outdoor } = shop();
  assert.equal(renameCategory(db, tools.id, '  Power  tools ').name, 'Power tools');
  assert.throws(() => moveCategory(db, outdoor.id, furniture.id), /below itself/);
  assert.equal(adminProductsIn(db, furniture.id).length, 2);
});

test('breadcrumbs and feed', () => {
  const { db } = shop();
  assert.deepEqual(breadcrumbs(db, 'TB-1'), [{ name: 'Outdoor', path: 'Outdoor' }, { name: 'Furniture', path: 'Outdoor > Furniture' }]);
  assert.deepEqual(merchantFeed(db)[0], { id: 'CH-1', title: 'Deck chair', price: '49.00 EUR', product_type: 'Outdoor > Furniture' });
});
