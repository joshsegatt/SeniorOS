import { formatPrice, getProduct, isSoldOut } from '../catalog/products.js';

/** @typedef {ReturnType<import('../catalog/store.js').createStore>} Store */

/**
 * Admin product screen: staff correct the stock count after a stock take or a damaged parcel.
 * @param {Store} store
 * @param {string} sku
 * @param {number} stock
 * @param {() => Date} [now]
 */
export function setStock(store, sku, stock, now = () => new Date()) {
  if (!Number.isInteger(stock) || stock < 0) throw new Error('stock must be a whole number, 0 or more');
  getProduct(store, sku);
  return store.update('products', (p) => p.sku === sku, { stock, updatedAt: now().toISOString() });
}

/** What the admin product screen shows. @param {Store} store @param {string} sku */
export function productAdminView(store, sku) {
  const product = getProduct(store, sku);
  const deliveries = store.all('deliveries').filter((d) => d.sku === sku);
  return {
    sku: product.sku,
    title: product.title,
    price: formatPrice(product.priceCents),
    stock: product.stock,
    status: isSoldOut(product) ? 'sold out' : 'in stock',
    lastDelivery: deliveries.at(-1)?.receivedAt ?? null,
  };
}
