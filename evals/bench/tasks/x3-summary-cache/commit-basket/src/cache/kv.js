// In-process stand-in for ShopKV (production: a networked key-value store shared by all app instances).
// Values are stored as JSON, like on the real server, so callers always get a fresh copy.

/**
 * @typedef {{
 *   get(key: string): Promise<any>,
 *   set(key: string, value: any, options?: { ttlMs?: number }): Promise<void>,
 *   delete(key: string): Promise<void>,
 * }} Kv
 */

/**
 * @param {Record<string, any>} [entries] initial values
 * @returns {Kv}
 */
export function createMemoryKv(entries = {}) {
  /** @type {Map<string, { json: string, expiresAt: number }>} */
  const data = new Map(Object.entries(entries).map(([k, v]) => [k, { json: JSON.stringify(v), expiresAt: Infinity }]));
  const roundTrip = () => new Promise((resolve) => setImmediate(resolve));
  return {
    async get(key) {
      await roundTrip();
      const entry = data.get(key);
      if (!entry) return null;
      if (entry.expiresAt <= Date.now()) {
        data.delete(key);
        return null;
      }
      return JSON.parse(entry.json);
    },
    async set(key, value, { ttlMs = Infinity } = {}) {
      await roundTrip();
      data.set(key, { json: JSON.stringify(value), expiresAt: Date.now() + ttlMs });
    },
    async delete(key) {
      await roundTrip();
      data.delete(key);
    },
  };
}
