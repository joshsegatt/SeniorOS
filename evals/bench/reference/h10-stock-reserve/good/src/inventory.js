/**
 * Stock levels per SKU, stored in ShopKV under `stock:<sku>`.
 * @param {import('../vendor/kv.js').KvClient} kv
 */
export function createInventory(kv) {
  const key = (sku) => `stock:${sku}`;

  return {
    /** Units in stock (0 for an unknown SKU). @param {string} sku */
    async stockOf(sku) {
      return (await kv.get(key(sku))) ?? 0;
    },

    /**
     * Goods received at the warehouse.
     * @param {string} sku
     * @param {number} qty
     */
    async restock(sku, qty) {
      if (!Number.isInteger(qty) || qty <= 0) throw new Error('qty must be a positive integer');
      await kv.incrBy(key(sku), qty);
    },

    /**
     * Takes items out of stock for an order. Throws when there is not enough stock.
     * Several app instances reserve concurrently, so the check and the decrement are one
     * compare-and-set in ShopKV, retried when another order changed the stock in between.
     * @param {string} sku
     * @param {number} qty
     */
    async reserve(sku, qty) {
      if (!Number.isInteger(qty) || qty <= 0) throw new Error('qty must be a positive integer');
      for (;;) {
        const current = await kv.get(key(sku));
        const available = current ?? 0;
        if (available < qty) throw new Error(`not enough stock for ${sku}: ${available} left, ${qty} requested`);
        if (await kv.compareAndSet(key(sku), current, available - qty)) return;
      }
    },
  };
}
