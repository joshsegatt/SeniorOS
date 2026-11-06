/**
 * Request limiter shared by the public API and the login guard.
 *
 * `hit(key)` records one request for `key` and returns true when it is allowed, false when the key already
 * had `limit` accepted requests in the last `windowMs` (a rolling period, so a burst on each side of a clock
 * boundary cannot add up to twice the limit).
 *
 * @param {{ limit: number, windowMs: number, now?: () => number }} options
 */
export function createRateLimiter({ limit, windowMs, now = Date.now }) {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('limit must be a positive integer');
  if (!(windowMs > 0)) throw new Error('windowMs must be positive');

  /** Accepted request times per key, oldest first. @type {Map<string, number[]>} */
  const accepted = new Map();

  return {
    /** @param {string} key */
    hit(key) {
      const t = now();
      const times = (accepted.get(key) ?? []).filter((at) => at > t - windowMs);
      if (times.length >= limit) {
        accepted.set(key, times);
        return false;
      }
      times.push(t);
      accepted.set(key, times);
      return true;
    },
    /** @param {string} key */
    reset(key) {
      accepted.delete(key);
    },
  };
}
