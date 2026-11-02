/** Stock levels per SKU, in process. */
export function createStock(initial = {}) {
  const levels = new Map(Object.entries(initial));
  return {
    /** @param {string} sku */
    stockOf(sku) {
      return levels.get(sku) ?? 0;
    },
    /** Takes items out of stock; throws if there are not enough. @param {string} sku @param {number} qty */
    take(sku, qty) {
      if (this.stockOf(sku) < qty) throw new Error(`not enough ${sku} in stock`);
      levels.set(sku, this.stockOf(sku) - qty);
    },
    /** Puts items back in stock. @param {string} sku @param {number} qty */
    putBack(sku, qty) {
      levels.set(sku, this.stockOf(sku) + qty);
    },
  };
}
