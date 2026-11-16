import { addPoints, awardOrderPoints } from '../loyalty/points.js';

/** @typedef {ReturnType<import('../db/store.js').createStore>} Store */

/**
 * A paid order from checkout. Earns points straight away.
 * @param {Store} store
 * @param {{ customerId: string, totalCents: number }} input
 * @param {() => Date} [now]
 */
export function placeOrder(store, input, now = () => new Date()) {
  if (!store.get('customers', input.customerId)) throw new Error(`unknown customer ${input.customerId}`);
  if (!Number.isInteger(input.totalCents) || input.totalCents <= 0) throw new Error('totalCents must be a positive integer');
  const order = store.insert('orders', { id: store.nextId('o'), customerId: input.customerId, totalCents: input.totalCents, status: 'paid', placedAt: now().toISOString() });
  awardOrderPoints(store, order, now);
  return order;
}

/**
 * Cancels an order and takes back the points it earned.
 * @param {Store} store
 * @param {string} orderId
 * @param {() => Date} [now]
 */
export function cancelOrder(store, orderId, now = () => new Date()) {
  const order = store.get('orders', orderId);
  if (!order) throw new Error(`unknown order ${orderId}`);
  if (order.status === 'cancelled') return order;
  const cancelled = store.replace('orders', order.id, { ...order, status: 'cancelled' });
  const earned = store.all('ledger').filter((e) => e.orderId === order.id).reduce((sum, e) => sum + e.points, 0);
  if (earned > 0) addPoints(store, { customerId: order.customerId, orderId: order.id, type: 'reverse', points: -earned }, now);
  return cancelled;
}
