// In-memory basket store (production: the baskets table; same API).

/** @param {Array<import('./summary.js').Basket>} [initial] */
export function createBasketStore(initial = []) {
  const baskets = new Map(initial.map((b) => [b.id, structuredClone(b)]));
  let reads = 0;
  return {
    /** How many times a basket was loaded (tests use it to check the cache). */
    get reads() {
      return reads;
    },
    /** @param {string} id */
    async get(id) {
      reads += 1;
      const basket = baskets.get(id);
      if (!basket) throw new Error(`no such basket: ${id}`);
      return structuredClone(basket);
    },
    /** @param {import('./summary.js').Basket} basket */
    async save(basket) {
      baskets.set(basket.id, structuredClone(basket));
    },
  };
}
