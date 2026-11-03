/**
 * Stand-in for the product database. Every method is one round trip; `stats.reads` counts product reads so we
 * can see the load the storefront puts on it.
 * @typedef {{ id: string, name: string, priceCents: number, stock: number, createdAt: string }} ProductRow
 */
export function createDb(seed = { products: [] }) {
  /** @type {Map<string, ProductRow>} */
  const products = new Map(seed.products.map((p) => [p.id, { ...p }]));
  const stats = { reads: 0, writes: 0 };

  return {
    stats,
    /** @param {string} id */
    getProduct(id) {
      stats.reads += 1;
      const row = products.get(id);
      return row ? { ...row } : null;
    },
    listProductIds() {
      stats.reads += 1;
      return [...products.keys()].sort();
    },
    /** @param {string} id @param {number} priceCents */
    setPrice(id, priceCents) {
      stats.writes += 1;
      const row = products.get(id);
      if (!row) throw new Error(`unknown product ${id}`);
      row.priceCents = priceCents;
    },
    /** @param {string} id @param {number} delta */
    adjustStock(id, delta) {
      stats.writes += 1;
      const row = products.get(id);
      if (!row) throw new Error(`unknown product ${id}`);
      row.stock += delta;
    },
  };
}
