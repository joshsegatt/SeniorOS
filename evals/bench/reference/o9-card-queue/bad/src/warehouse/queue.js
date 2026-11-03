const HOUR = 60 * 60 * 1000;
const STUCK_AFTER = 14 * 24 * HOUR;

/**
 * Payment time in milliseconds. Card payments come from the provider webhook as unix seconds, transfers as ISO strings.
 * @param {string | number | undefined} paidAt
 */
function paidTime(paidAt) {
  if (typeof paidAt === 'number') return paidAt * 1000;
  return paidAt ? Date.parse(paidAt) : NaN;
}

/**
 * Paid orders waiting to be packed, oldest payment first. Orders paid more than 14 days ago and still not
 * shipped leave the queue and show up in `stuckOrders` for customer service instead.
 * @param {ReturnType<import('../orders/store.js').createOrderStore>} store
 * @param {Date} now
 */
export function shippingQueue(store, now) {
  const since = now.getTime() - STUCK_AFTER;
  return store
    .all()
    .filter((o) => o.status === 'paid' && !o.shippedAt && paidTime(o.paidAt) >= since)
    .sort((a, b) => paidTime(a.paidAt) - paidTime(b.paidAt))
    .map((o) => ({ id: o.id, customerId: o.customerId, paidAt: new Date(paidTime(o.paidAt)).toISOString(), waitingHours: Math.floor((now.getTime() - paidTime(o.paidAt)) / HOUR) }));
}

/**
 * @param {ReturnType<import('../orders/store.js').createOrderStore>} store
 * @param {Date} now
 */
export function stuckOrders(store, now) {
  const since = now.getTime() - STUCK_AFTER;
  return store
    .all()
    .filter((o) => o.status === 'paid' && !o.shippedAt && paidTime(o.paidAt) < since)
    .map((o) => o.id);
}
