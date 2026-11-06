/** @typedef {import('../orders/orders.js').Order} Order */

/**
 * Charge a pending order and record the result on it.
 * @param {{ orders: ReturnType<import('../orders/orders.js').createOrderStore>, gateway: ReturnType<import('./gateway.js').createFakeGateway> }} deps
 * @param {Order} order
 * @param {string} paymentMethod
 * @returns {Promise<Order>}
 */
export async function chargeOrder(deps, order, paymentMethod) {
  if (order.status !== 'pending') throw new Error(`order ${order.id} is ${order.status}, not pending`);
  let result;
  try {
    result = await deps.gateway.charge({ paymentMethod, amountCents: order.totalCents, reference: order.id });
  } catch (error) {
    await deps.orders.update(order.id, { status: 'failed' });
    throw error;
  }
  if (!result.ok) return deps.orders.update(order.id, { status: 'declined' });
  return deps.orders.update(order.id, { status: 'paid', chargeId: result.chargeId });
}
