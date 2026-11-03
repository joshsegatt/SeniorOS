const NEW_FOR_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Product reads for the storefront and checkout.
 * @param {{ db: ReturnType<import('./db.js').createDb>, clock: { now: () => Date } }} deps
 */
export function createCatalog({ db, clock }) {
  /**
   * @param {string} id
   * @returns {{ id: string, name: string, priceCents: number, stock: number, isNew: boolean } | null}
   */
  function getProduct(id) {
    const row = db.getProduct(id);
    if (!row) return null;
    const isNew = clock.now().getTime() - Date.parse(row.createdAt) < NEW_FOR_MS;
    return { id: row.id, name: row.name, priceCents: row.priceCents, stock: row.stock, isNew };
  }

  function listProducts() {
    return db.listProductIds().map(getProduct).filter(Boolean);
  }

  return { getProduct, listProducts };
}
