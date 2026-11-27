import { cacheKey } from '../util/keys.js';

// Memoizes gross prices per SKU. Entries live until invalidated: every writer
// that changes a price (admin, feed import) must call invalidate(sku).

export function createPriceCache(compute) {
  const entries = new Map();
  let computes = 0;

  return {
    priceFor(sku, product) {
      const key = cacheKey(sku);
      if (!entries.has(key)) {
        computes += 1;
        entries.set(key, compute(product));
      }
      return entries.get(key);
    },

    invalidate(sku) {
      return entries.delete(cacheKey(sku));
    },

    clear() {
      entries.clear();
    },

    get size() {
      return entries.size;
    },

    /** Number of times compute() ran; used by tests and the /metrics page. */
    get computes() {
      return computes;
    },
  };
}
