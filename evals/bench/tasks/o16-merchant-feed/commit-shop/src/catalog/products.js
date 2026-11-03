/**
 * Product catalog.
 * @typedef {{ sku: string, title: string, price: number, stock: number, active: boolean }} Product
 *   price: integer amount in the minor unit of the shop currency
 */
export function createProductStore() {
  /** @type {Map<string, Product>} */
  const products = new Map();
  return {
    /** @param {Product} product */
    put(product) {
      if (!Number.isInteger(product.price) || product.price < 0) throw new Error(`invalid price for ${product.sku}`);
      products.set(product.sku, { ...product });
    },
    /** @param {string} sku */
    get(sku) {
      const p = products.get(sku);
      return p ? { ...p } : null;
    },
    all: () => [...products.values()].map((p) => ({ ...p })),
  };
}
