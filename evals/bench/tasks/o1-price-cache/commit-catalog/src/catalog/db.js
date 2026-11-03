/**
 * Product table access. Every call is a round trip to the database server, so it is async;
 * `latencyMs` simulates the network in dev (production sits around 15-40 ms per query).
 * @typedef {{ id: string, name: string, priceCents: number }} Product
 */

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** @param {Product[]} seed @param {{ latencyMs?: number }} [options] */
export function createProductDb(seed, { latencyMs = 0 } = {}) {
  /** @type {Map<string, Product>} */
  const rows = new Map(seed.map((p) => [p.id, { ...p }]));
  const stats = { queries: 0 };

  return {
    stats,
    /** @param {string} id @returns {Promise<Product | null>} */
    async getProduct(id) {
      stats.queries += 1;
      const row = rows.get(id);
      const result = row ? { ...row } : null; // the row as the query saw it
      await delay(latencyMs);
      return result;
    },
    /** @param {string} id @param {number} priceCents */
    async setPrice(id, priceCents) {
      stats.queries += 1;
      await delay(latencyMs);
      const row = rows.get(id);
      if (!row) throw new Error(`no product ${id}`);
      row.priceCents = priceCents;
    },
  };
}
