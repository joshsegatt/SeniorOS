// In-memory stand-ins for the orders table and the sync checkpoint row (production uses Postgres; same API).

/** @param {Array<{ id: number, totalCents: number, placedAt: string }>} rows */
export function createOrderSource(rows) {
  return {
    /** Placed orders with an id greater than `afterId`, in id order. @param {number} afterId */
    async placedAfter(afterId) {
      await new Promise((resolve) => setImmediate(resolve));
      return rows.filter((o) => o.id > afterId).sort((a, b) => a.id - b.id);
    },
  };
}

/** The id of the last order known to be in Ledgerly. @param {number} [initial] */
export function createCheckpoint(initial = 0) {
  let value = initial;
  return {
    async get() {
      return value;
    },
    /** @param {number} id */
    async set(id) {
      value = id;
    },
  };
}
