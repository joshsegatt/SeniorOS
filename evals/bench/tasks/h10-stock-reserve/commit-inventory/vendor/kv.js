// ShopKV client, v1.4.0. Vendored copy: do not edit, upgrade it as a whole.
//
// ShopKV is a small networked key-value store. Values are numbers. Every method is one
// round trip to the server, and every method is atomic on the server:
//
//   get(key)                          -> current value, or null when the key does not exist
//   set(key, value)                   -> overwrites the value
//   incrBy(key, delta)                -> adds delta (may be negative) and returns the new value;
//                                        a missing key counts as 0
//   compareAndSet(key, expected, value) -> writes value only if the current value is still
//                                        `expected` (null = key missing); returns true if it wrote
//
// Production code gets a client from `connect(url)`. Tests and local development use
// `createMemoryKv(initial)`, an in-process server with the same semantics and the same
// asynchronous round trips.

/**
 * @typedef {{
 *   get(key: string): Promise<number | null>,
 *   set(key: string, value: number): Promise<void>,
 *   incrBy(key: string, delta: number): Promise<number>,
 *   compareAndSet(key: string, expected: number | null, value: number): Promise<boolean>,
 * }} KvClient
 */

/**
 * @param {Record<string, number>} [initial]
 * @returns {KvClient}
 */
export function createMemoryKv(initial = {}) {
  const data = new Map(Object.entries(initial));
  const roundTrip = () => new Promise((resolve) => setImmediate(resolve));
  const current = (key) => (data.has(key) ? data.get(key) : null);
  return {
    async get(key) {
      await roundTrip();
      return current(key);
    },
    async set(key, value) {
      await roundTrip();
      data.set(key, value);
    },
    async incrBy(key, delta) {
      await roundTrip();
      const next = (current(key) ?? 0) + delta;
      data.set(key, next);
      return next;
    },
    async compareAndSet(key, expected, value) {
      await roundTrip();
      if (current(key) !== expected) return false;
      data.set(key, value);
      return true;
    },
  };
}

/**
 * @param {string} url e.g. https://kv.internal:7379
 * @returns {KvClient}
 */
export function connect(url) {
  const call = async (op, body) => {
    const res = await fetch(`${url}/v1/${op}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`ShopKV ${op} failed: ${res.status}`);
    return (await res.json()).result;
  };
  return {
    get: (key) => call('get', { key }),
    set: (key, value) => call('set', { key, value }),
    incrBy: (key, delta) => call('incrby', { key, delta }),
    compareAndSet: (key, expected, value) => call('cas', { key, expected, value }),
  };
}
