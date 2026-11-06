/**
 * Request limiter shared by the public API and the login guard.
 *
 * `hit(key)` records one request for `key` and returns true when it is allowed, false when the key is over
 * its limit (`limit` requests per `windowMs`). The window starts at the key's first request instead of at a
 * clock boundary, so a client that starts just before a second ticks over is not reset mid-burst.
 *
 * @param {{ limit: number, windowMs: number, now?: () => number }} options
 */
export function createRateLimiter({ limit, windowMs, now = Date.now }) {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('limit must be a positive integer');
  if (!(windowMs > 0)) throw new Error('windowMs must be positive');

  /** @type {Map<string, { start: number, count: number }>} */
  const counters = new Map();

  return {
    /** @param {string} key */
    hit(key) {
      const t = now();
      const counter = counters.get(key);
      if (!counter || t - counter.start >= windowMs) {
        counters.set(key, { start: t, count: 1 });
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
