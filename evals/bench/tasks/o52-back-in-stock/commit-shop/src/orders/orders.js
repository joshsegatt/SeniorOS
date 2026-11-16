import { getProduct } from '../catalog/products.js';
import { normalizeEmail, sendEmail } from '../email/outbox.js';

/** @typedef {ReturnType<import('../catalog/store.js').createStore>} Store */

/**
 * Checkout: takes the stock and sends the order confirmation.
 * @param {Store} store
 * @param {{ email: string, lines: { sku: string, quantity: number }[] }} input
 * @param {() => Date} [now]
 */
export function placeOrder(store, input, now = () => new Date()) {
  const email = normalizeEmail(input.email);
  if (!input.lines?.length) throw new Error('order has no lines');
  const products = input.lines.map((line) => {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) throw new Error('quantity must be a positive whole number');
    const product = getProduct(store, line.sku);
    if (product.stock < line.quantity) throw new Error(`out of stock: ${line.sku}`);
    return product;
  });
  const at = now().toISOString();
  input.lines.forEach((line, i) => store.update('products', (p) => p.sku === line.sku, { stock: products[i].stock - line.quantity, updatedAt: at }));
  const totalCents = input.lines.reduce((sum, line, i) => sum + products[i].priceCents * line.quantity, 0);
  const order = store.insert('orders', { id: store.nextId('o'), email, lines: input.lines.map((l) => ({ ...l })), totalCents, placedAt: at });
  sendEmail(store, { to: email, template: 'order-confirmation', data: { orderId: order.id, totalCents } }, now);
  return order;
}
