import { getProduct } from '../catalog/products.js';
import { notifyIfBackInStock } from '../shop/back-in-stock.js';

/** @typedef {ReturnType<import('../catalog/store.js').createStore>} Store */

/**
 * The warehouse app books in a delivery from a supplier: the units go on the shelf right away.
 * @param {Store} store
 * @param {{ sku: string, quantity: number, supplier?: string }} delivery
 * @param {() => Date} [now]
 */
export function receiveDelivery(store, delivery, now = () => new Date()) {
  const { sku, quantity } = delivery;
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error('quantity must be a positive whole number');
  const product = getProduct(store, sku);
  const at = now().toISOString();
  store.insert('deliveries', { id: store.nextId('d'), sku, quantity, supplier: delivery.supplier ?? null, receivedAt: at });
  const after = store.update('products', (p) => p.sku === sku, { stock: product.stock + quantity, updatedAt: at });
  notifyIfBackInStock(store, product, after, now);
  return after;
}
