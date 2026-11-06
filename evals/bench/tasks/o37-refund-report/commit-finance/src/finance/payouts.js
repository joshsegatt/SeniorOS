/**
 * Checks a provider payout against our own records: charges captured minus refunds made in the
 * payout window [from, to), minus the provider's fees.
 * @param {ReturnType<import('./store.js').createPaymentsStore>} store
 * @param {{ id: string, from: string, to: string, amountCents: number, feesCents: number }} payout
 */
export function reconcilePayout(store, payout) {
  const from = Date.parse(payout.from);
  const to = Date.parse(payout.to);
  const within = (/** @type {string} */ iso) => Date.parse(iso) >= from && Date.parse(iso) < to;
  const charges = store
    .payments()
    .filter((p) => within(p.capturedAt))
    .reduce((sum, p) => sum + p.amountCents, 0);
  const refunds = store
    .refunds()
    .filter((r) => within(r.createdAt))
    .reduce((sum, r) => sum + (r.amountCents ?? 0), 0);
  const expectedCents = charges - refunds - payout.feesCents;
  const differenceCents = payout.amountCents - expectedCents;
  return { payoutId: payout.id, expectedCents, differenceCents, matched: differenceCents === 0 };
}
