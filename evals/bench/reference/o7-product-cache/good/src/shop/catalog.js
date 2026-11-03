const NEW_FOR_MS = 30 * 24 * 60 * 60 * 1000;
const CACHE_TTL_MS = 60_000;

/**
 * Product reads for the storefront and checkout.
 * @param {{ db: ReturnType<import('./db.js').createDb>, clock: { now: () => Date } }} deps
 */
export function createCatalog({ db, clock }) {
  /** @type {Map<string, { row: import('./db.js').ProductRow | null, expiresAt: number }>} */
  const cache = new Map();

  /** @param {string} id */
  function readRow(id) {
    const now = clock.now().getTime();
    const hit = cache.get(id);
    if (hit && hit.expiresAt > now) return hit.row;
    const row = db.getProduct(id);
    cache.set(id, { row, expiresAt: now + CACHE_TTL_MS });
    return row;
  }

  /**
   * @param {string} id
   * @returns {{ id: string, name: string, priceCents: number, stock: number, isNew: boolean } | null}
   */
  function getProduct(id) {
    const row = readRow(id);
    if (!row) return null;
    const isNew = clock.now().getTime() - Date.parse(row.createdAt) < NEW_FOR_MS;
    return { id: row.id, name: row.name, priceCents: row.priceCents, stock: row.stock, isNew };
  }

  function listProducts() {
    return db.listProductIds().map(getProduct).filter(Boolean);
  }

  /** Drops a cached product after a write, so the next read sees it. @param {string} id */
  function invalidate(id) {
    cache.delete(id);
  }

  function clear() {
    cache.clear();
  }

  return { getProduct, listProducts, invalidate, clear };
}
