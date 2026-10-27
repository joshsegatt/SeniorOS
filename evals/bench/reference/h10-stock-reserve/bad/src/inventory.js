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
     * @param {string} sku
     * @param {number} qty
     */
    async reserve(sku, qty) {
      if (!Number.isInteger(qty) || qty <= 0) throw new Error('qty must be a positive integer');
      const available = await this.stockOf(sku);
      if (available < qty) throw new Error(`not enough stock for ${sku}: ${available} left, ${qty} requested`);
      await kv.incrBy(key(sku), -qty);
    },
  };
}
