import { systemClock, dayOf } from './clock.js';
import { DASHBOARD_CACHE_TTL_MS } from './config.js';
import { createTtlCache } from './ttl-cache.js';
import { summarize } from './metrics.js';

/** Daily summaries per store, cached in front of the ledger (docs/caching.md). */
export function createDashboard({ ledger, clock = systemClock, ttlMs = DASHBOARD_CACHE_TTL_MS }) {
  const cache = createTtlCache({ ttlMs, clock });
  // Rule 1: one entry per (store, day); the day is part of the key.
  const keyFor = (storeId, day) => `summary:${storeId}:${day}`;

  function dailySummary(storeId, day = dayOf(clock.now())) {
    const key = keyFor(storeId, day);
    const cached = cache.get(key);
    if (cached) return cached;
    const summary = Object.freeze({ storeId, day, ...summarize(ledger.scan(storeId, day)) });
    cache.set(key, summary);
    return summary;
  }

  /** Called by every write path for the (store, day) it wrote. */
  function invalidate(storeId, day) {
    cache.delete(keyFor(storeId, day));
  }

  return { dailySummary, invalidate };
}
