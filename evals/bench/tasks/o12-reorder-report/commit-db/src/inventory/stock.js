/** @typedef {import('../db/memory.js').Db} Db */

/**
 * Units on hand for one product. Products that were never stocked have no stock document: 0.
 * @param {Db} db
 * @param {string} sku
 */
export async function getStockLevel(db, sku) {
  const doc = await db.findOne('stock', { sku });
  return doc ? Number(doc.onHand) : 0;
}
