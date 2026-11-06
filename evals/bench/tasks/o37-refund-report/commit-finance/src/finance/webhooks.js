/**
 * Events posted by the payment provider. Refunds made in the provider dashboard arrive as
 * `charge.refunded`; the provider retries, so the same refund can arrive more than once.
 * @param {ReturnType<import('./store.js').createPaymentsStore>} store
 * @param {{ id: string, type: string, data: { charge: string, refund: { id: string, amount: number, created: number } } }} event
 */
export function handleProviderEvent(store, event) {
  if (event.type !== 'charge.refunded') return { handled: false };
  const payment = store.findPaymentByCharge(event.data.charge);
  if (!payment) throw new Error(`unknown charge ${event.data.charge}`);
  const { refund } = event.data;
  if (store.refundsFor(payment.id).some((r) => r.providerRefundId === refund.id)) return { handled: false };
  store.insertRefund({
    id: store.nextId('rf'),
    paymentId: payment.id,
    orderId: payment.orderId,
    customerId: payment.customerId,
    amountCents: refund.amount,
    source: 'provider',
    providerRefundId: refund.id,
    createdAt: new Date(refund.created * 1000).toISOString(),
  });
  return { handled: true };
}
