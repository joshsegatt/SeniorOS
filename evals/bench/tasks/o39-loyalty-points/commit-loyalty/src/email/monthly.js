import { pointsFor } from '../loyalty/points.js';

const dollars = (cents) => `$${(cents / 100).toFixed(2)}`;

/**
 * The monthly purchase history email, sent on the 1st for the previous month.
 * @param {ReturnType<import('../loyalty/store.js').createLoyaltyStore>} store
 * @param {string} customerId
 * @param {string} month e.g. "2026-10"
 */
export function monthlyHistoryEmail(store, customerId, month) {
  const member = store.getMember(customerId);
  if (!member) throw new Error(`unknown member ${customerId}`);
  const purchases = store
    .purchasesFor(customerId)
    .filter((p) => p.purchasedAt.startsWith(month))
    .sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt));
  return {
    to: member.email,
    subject: `Your ${month} coffee recap`,
    lines: purchases.map((p) => `${p.purchasedAt.slice(0, 10)}  ${p.storeId}  ${dollars(p.totalCents)}  +${pointsFor(p.totalCents)} pts`),
    pointsEarned: purchases.reduce((sum, p) => sum + pointsFor(p.totalCents), 0),
  };
}
