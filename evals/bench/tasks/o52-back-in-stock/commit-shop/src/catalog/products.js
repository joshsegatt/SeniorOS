/** @typedef {ReturnType<import('./store.js').createStore>} Store */
/** @typedef {{ sku: string, title: string, slug: string, priceCents: number, stock: number, updatedAt?: string }} Product */

/** @param {Store} store @param {string} sku @returns {Product} */
export function getProduct(store, sku) {
  const product = store.find('products', (p) => p.sku === sku);
  if (!product) throw new Error(`unknown product ${sku}`);
  return product;
}

/** @param {Product} product */
export function isSoldOut(product) {
  return product.stock <= 0;
}

/** "CHF 24.90" @param {number} cents */
export function formatPrice(cents) {
  return `CHF ${(cents / 100).toFixed(2)}`;
}
