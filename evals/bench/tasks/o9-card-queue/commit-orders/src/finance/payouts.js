/**
 * What the card provider should pay out for one day (UTC), to reconcile with the bank statement.
 * @param {ReturnType<import('../orders/store.js').createOrderStore>} store
 * @param {string} day YYYY-MM-DD
 */
export function cardPayoutReport(store, day) {
  const paid = store.all().filter((o) => o.paymentMethod === 'card' && o.paidAt && o.paidAt.slice(0, 10) === day);
  return { day, orders: paid.length, grossCents: paid.reduce((sum, o) => sum + o.totalCents, 0) };
}
