/**
 * Store credit (refunds kept as credit, goodwill gestures) pays down the customer's unpaid orders.
 * @param {ReturnType<typeof import('../orders/store.js').createOrderStore>} store
 * @param {string} customerId
 * @param {number} creditCents
 * @returns {{ applied: { orderId: string, cents: number }[], leftCents: number }}
 */
export function applyCredit(store, customerId, creditCents) {
  let left = creditCents;
  const applied = [];
  for (const order of store.openOrders(customerId)) {
    if (left === 0) break;
    const cents = Math.min(left, order.balanceCents);
    const balanceCents = order.balanceCents - cents;
    store.update(order.id, { balanceCents, status: balanceCents === 0 ? 'paid' : 'open' });
    applied.push({ orderId: order.id, cents });
    left -= cents;
  }
  return { applied, leftCents: left };
}
