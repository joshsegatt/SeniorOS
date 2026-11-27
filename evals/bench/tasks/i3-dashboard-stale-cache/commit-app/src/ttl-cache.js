/** Minimal TTL cache driven by an injected clock. */
export function createTtlCache({ ttlMs, clock }) {
  if (!Number.isInteger(ttlMs) || ttlMs <= 0) throw new RangeError('ttlMs must be a positive integer');
  const entries = new Map();

  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (clock.now() >= entry.expiresAt) {
        entries.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key, value) {
      entries.set(key, { value, expiresAt: clock.now() + ttlMs });
    },
    delete(key) {
      entries.delete(key);
    },
    get size() {
      return entries.size;
    },
  };
}
