/**
 * @typedef {{ sku: string, name: string, active: boolean, supplierId: string, reorderPoint: number }} Product
 * @typedef {import('../db/memory.js').Db} Db
 */

/** @param {Db} db @returns {Promise<Product[]>} */
export async function listActiveProducts(db) {
  return /** @type {any} */ (await db.find('products', { active: true }));
}

/** @param {Db} db @param {string} sku @returns {Promise<Product | null>} */
export async function getProduct(db, sku) {
  return /** @type {any} */ (await db.findOne('products', { sku }));
}

/** Used by the cart to load all its lines at once. @param {Db} db @param {string[]} skus @returns {Promise<Product[]>} */
export async function getProductsBySkus(db, skus) {
  if (skus.length === 0) return [];
  return /** @type {any} */ (await db.find('products', { sku: { $in: skus } }));
}
