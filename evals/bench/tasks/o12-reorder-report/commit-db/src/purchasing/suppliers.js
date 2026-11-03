/**
 * @typedef {{ id: string, name: string, email: string }} Supplier
 * @typedef {import('../db/memory.js').Db} Db
 */

/** @param {Db} db @param {string} id @returns {Promise<Supplier | null>} */
export async function getSupplier(db, id) {
  return /** @type {any} */ (await db.findOne('suppliers', { id }));
}
