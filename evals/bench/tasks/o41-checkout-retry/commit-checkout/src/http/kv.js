/** A turn of the event loop, like a round trip to Redis. */
const io = () => new Promise((resolve) => setImmediate(resolve));

/**
 * In-memory key-value store with the same async interface as the production Redis client wrapper.
 * Values are stored as JSON, so callers always get a copy.
 */
export function createMemoryKv() {
  /** @type {Map<string, string>} */
  const data = new Map();
  return {
    /** @param {string} key */
    async get(key) {
      await io();
      const raw = data.get(key);
      return raw === undefined ? null : JSON.parse(raw);
    },
    /** @param {string} key @param {unknown} value */
    async set(key, value) {
      await io();
      data.set(key, JSON.stringify(value));
    },
    /** @param {string} key */
    async del(key) {
      await io();
      data.delete(key);
    },
    /** @param {string} prefix */
    async keys(prefix = '') {
      await io();
      return [...data.keys()].filter((k) => k.startsWith(prefix));
    },
  };
}
