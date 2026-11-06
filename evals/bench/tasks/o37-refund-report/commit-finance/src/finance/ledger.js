/**
 * What a customer has paid and been refunded, for the back office customer page.
 * @param {ReturnType<import('./store.js').createPaymentsStore>} store
 * @param {string} customerId
 */
export function customerBalance(store, customerId) {
  const paidCents = store
    .payments()
    .filter((p) => p.customerId === customerId)
    .reduce((sum, p) => sum + p.amountCents, 0);
  const refundedCents = store
    .refunds()
    .filter((r) => r.customerId === customerId)
    .reduce((sum, r) => sum + (r.amountCents ?? 0), 0);
  return { paidCents, refundedCents, netCents: paidCents - refundedCents };
}
