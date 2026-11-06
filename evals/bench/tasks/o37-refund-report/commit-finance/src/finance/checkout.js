/** @typedef {ReturnType<import('./store.js').createPaymentsStore>} PaymentsStore */

/**
 * The card payment captured when the customer places an order.
 * @param {PaymentsStore} store
 * @param {{ orderId: string, customerId: string, amountCents: number, providerChargeId: string }} input
 * @param {() => Date} [now]
 */
export function capturePayment(store, input, now = () => new Date()) {
  if (!input.orderId || !input.customerId) throw new Error('orderId and customerId are required');
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new Error('amountCents must be a positive integer');
  if (!input.providerChargeId) throw new Error('providerChargeId is required');
  return store.insertPayment({
    id: store.nextId('pay'),
    orderId: input.orderId,
    customerId: input.customerId,
    amountCents: input.amountCents,
    providerChargeId: input.providerChargeId,
    capturedAt: now().toISOString(),
  });
}

/**
 * Order cancelled: refund whatever has not been refunded yet.
 * @param {PaymentsStore} store
 * @param {string} paymentId
 * @param {{ reason?: string }} [options]
 * @param {() => Date} [now]
 */
export function refundOrder(store, paymentId, options = {}, now = () => new Date()) {
  const payment = store.getPayment(paymentId);
  if (!payment) throw new Error(`unknown payment ${paymentId}`);
  const refunded = store.refundsFor(payment.id).reduce((sum, r) => sum + (r.amountCents ?? 0), 0);
  const remaining = payment.amountCents - refunded;
  if (remaining <= 0) throw new Error('payment is already fully refunded');
  return store.insertRefund({
    id: store.nextId('rf'),
    paymentId: payment.id,
    orderId: payment.orderId,
    customerId: payment.customerId,
    amountCents: remaining,
    source: 'checkout',
    reason: options.reason ?? 'order cancelled',
    createdAt: now().toISOString(),
  });
}
