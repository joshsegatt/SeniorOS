/**
 * Events posted by the card payment provider (already signature-checked by the HTTP layer).
 * @typedef {{
 *   id: string,
 *   type: 'charge.succeeded' | 'charge.refunded' | 'charge.failed',
 *   created: number,
 *   data: { orderId: string, amountCents: number }
 * }} ProviderEvent  `created` is a unix timestamp in seconds
 */

/**
 * @param {ReturnType<import('../orders/store.js').createOrderStore>} store
 * @param {ProviderEvent} event
 * @returns {{ handled: boolean, reason?: string }}
 */
export function handlePaymentEvent(store, event) {
  const order = store.get(event.data.orderId);
  if (!order) return { handled: false, reason: 'unknown order' };
  switch (event.type) {
    case 'charge.succeeded':
      if (order.status !== 'pending') return { handled: false, reason: `order is ${order.status}` };
      if (event.data.amountCents !== order.totalCents) return { handled: false, reason: 'amount mismatch' };
      store.update(order.id, { status: 'paid', paymentMethod: 'card', paidAt: event.created });
      return { handled: true };
    case 'charge.refunded':
      if (order.status !== 'paid' && order.status !== 'shipped') return { handled: false, reason: `order is ${order.status}` };
      store.update(order.id, { status: 'refunded', refundedAt: event.created });
      return { handled: true };
    case 'charge.failed':
      return { handled: true };
    default:
      return { handled: false, reason: `unsupported event ${event.type}` };
  }
}
