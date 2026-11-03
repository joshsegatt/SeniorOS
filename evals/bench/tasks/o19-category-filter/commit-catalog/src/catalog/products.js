import { categoryPath } from './categories.js';

/** @typedef {ReturnType<import('./db.js').createCatalogDb>} CatalogDb */

/** @param {CatalogDb} db @param {{ sku: string, title: string, price: number, categoryId: string }} input */
export function createProduct(db, input) {
  const sku = String(input.sku ?? '').trim().toUpperCase();
  if (!sku) throw new Error('sku is required');
  if (db.products.has(sku)) throw new Error(`sku ${sku} exists`);
  const product = { sku, title: String(input.title ?? '').trim(), price: input.price, categoryId: input.categoryId, categoryPath: categoryPath(db, input.categoryId), active: true };
  db.products.set(sku, product);
  return { ...product };
}

/** @param {CatalogDb} db @param {string} sku @param {Partial<{ title: string, price: number, categoryId: string, active: boolean }>} patch */
export function updateProduct(db, sku, patch) {
  const product = db.products.get(sku);
  if (!product) throw new Error(`unknown sku ${sku}`);
  Object.assign(product, patch);
  if ('categoryId' in patch) product.categoryPath = categoryPath(db, product.categoryId);
  return { ...product };
}

/** Admin product list for one category (not including subcategories). @param {CatalogDb} db @param {string} categoryId */
export function adminProductsIn(db, categoryId) {
  return [...db.products.values()].filter((p) => p.categoryId === categoryId).map((p) => ({ ...p }));
}
