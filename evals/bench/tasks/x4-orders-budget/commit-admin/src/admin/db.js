// Database access for the admin back office. In production every call below is one query, i.e. one round trip to
// the read replica; this in-memory version has the same API and counts the round trips in `stats`.

/**
 * @typedef {{ id: string, name: string, email: string }} Customer
 * @typedef {{ id: string, customerId: string, totalCents: number, status: 'paid' | 'shipped' | 'refunded', placedAt: string }} Order
 * @typedef {{ id: string, name: string, categoryId: string, priceCents: number }} Product
 * @typedef {{ id: string, name: string }} Category
 */

const tick = () => new Promise((resolve) => setImmediate(resolve));

/**
 * @template T
 * @param {T[]} rows
 * @param {{ roundTrips: number }} stats
 */
function table(rows, stats) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const copy = (r) => (r ? { ...r } : null);
  return {
    /** @param {string} id @returns {Promise<T | null>} */
    async get(id) {
      stats.roundTrips += 1;
      await tick();
      return copy(byId.get(id));
    },
    /** @returns {Promise<T[]>} */
    async all() {
      stats.roundTrips += 1;
      await tick();
      return rows.map(copy);
    },
    /**
     * Rows whose `field` is one of `values` (SQL `WHERE field IN (...)`), in one query.
     * @param {string} field @param {unknown[]} values @returns {Promise<T[]>}
     */
    async whereIn(field, values) {
      stats.roundTrips += 1;
      await tick();
      const wanted = new Set(values);
      return rows.filter((r) => wanted.has(r[field])).map(copy);
    },
  };
}

/**
 * @param {{ customers?: Customer[], orders?: Order[], products?: Product[], categories?: Category[] }} seed
 */
export function createDb(seed = {}) {
  const stats = { roundTrips: 0 };
  return {
    stats,
    customers: table(seed.customers ?? [], stats),
    orders: table(seed.orders ?? [], stats),
    products: table(seed.products ?? [], stats),
    categories: table(seed.categories ?? [], stats),
  };
}
