/**
 * Request limiter shared by the public API and the login guard.
 *
 * `hit(key)` records one request for `key` and returns true when it is allowed, false when the key is over
 * its limit (`limit` requests per `windowMs`).
 *
 * @param {{ limit: number, windowMs: number, now?: () => number }} options
 */
export function createRateLimiter({ limit, windowMs, now = Date.now }) {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('limit must be a positive integer');
  if (!(windowMs > 0)) throw new Error('windowMs must be positive');

  /** @type {Map<string, { window: number, count: number }>} */
  const counters = new Map();

  return {
    /** @param {string} key */
    hit(key) {
      const window = Math.floor(now() / windowMs);
      const counter = counters.get(key);
      if (!counter || counter.window !== window) {
        counters.set(key, { window, count: 1 });
        return true;
      }
      if (counter.count >= limit) return false;
      counter.count += 1;
      return true;
    },
    /** @param {string} key */
    reset(key) {
      counters.delete(key);
    },
  };
}
