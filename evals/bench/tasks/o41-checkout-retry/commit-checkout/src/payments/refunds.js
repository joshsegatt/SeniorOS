/**
 * Refund part or all of a paid order. Never more than was charged in total, even when two refunds are sent at once.
 * @param {{ orders: ReturnType<import('../orders/orders.js').createOrderStore>, gateway: ReturnType<import('./gateway.js').createFakeGateway> }} deps
 * @param {string} orderId
 * @param {number} amountCents
 * @returns {Promise<{ ok: true, refundId: string, refundedCents: number } | { ok: false, error: string }>}
 */
export async function refundOrder(deps, orderId, amountCents) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) return { ok: false, error: 'amountCents must be a positive integer' };
  const order = await deps.orders.get(orderId);
  if (!order) return { ok: false, error: `unknown order ${orderId}` };
  if (order.status !== 'paid' || !order.chargeId) return { ok: false, error: `order ${orderId} is not paid` };
  if (!deps.orders.reserveRefund(orderId, amountCents)) return { ok: false, error: 'refund is more than what is left on the order' };

  let sent = false;
  try {
    const { refundId } = await deps.gateway.refund({ chargeId: order.chargeId, amountCents });
    sent = true;
    return { ok: true, refundId, refundedCents: amountCents };
  } finally {
    deps.orders.settleRefund(orderId, amountCents, sent);
  }
}
