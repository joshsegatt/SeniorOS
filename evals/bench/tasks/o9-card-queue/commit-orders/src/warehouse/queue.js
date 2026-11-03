const HOUR = 60 * 60 * 1000;
const STUCK_AFTER = 14 * 24 * HOUR;

/** @param {Date} now */
const cutoff = (now) => new Date(now.getTime() - STUCK_AFTER).toISOString();

/**
 * Paid orders waiting to be packed, oldest payment first. Orders paid more than 14 days ago and still not
 * shipped leave the queue and show up in `stuckOrders` for customer service instead.
 * @param {ReturnType<import('../orders/store.js').createOrderStore>} store
 * @param {Date} now
 */
export function shippingQueue(store, now) {
  const since = cutoff(now);
  return store
    .all()
    .filter((o) => o.status === 'paid' && !o.shippedAt && o.paidAt >= since)
    .sort((a, b) => a.paidAt.localeCompare(b.paidAt))
    .map((o) => ({ id: o.id, customerId: o.customerId, paidAt: o.paidAt, waitingHours: Math.floor((now.getTime() - Date.parse(o.paidAt)) / HOUR) }));
}

/**
 * @param {ReturnType<import('../orders/store.js').createOrderStore>} store
 * @param {Date} now
 */
export function stuckOrders(store, now) {
  const since = cutoff(now);
  return store
    .all()
    .filter((o) => o.status === 'paid' && !o.shippedAt && o.paidAt < since)
    .map((o) => o.id);
}
