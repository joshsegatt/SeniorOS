/**
 * In-memory product catalog.
 * @typedef {{ sku: string, name: string, priceCents: number, source: 'admin' | 'feed' }} Product
 */
export function createCatalog() {
  /** @type {Map<string, Product>} */
  const products = new Map();
  return {
    /** @param {Product} product */
    upsert(product) {
      products.set(product.sku, { ...product });
      return { ...product };
    },
    /** @param {string} sku */
    get(sku) {
      const p = products.get(sku);
      return p ? { ...p } : null;
    },
    all: () => [...products.values()].map((p) => ({ ...p })),
  };
}
