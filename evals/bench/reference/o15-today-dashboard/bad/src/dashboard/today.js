/**
 * Orders placed today so far, not counting cancelled ones.
 * @param {ReturnType<import('../orders/store.js').createOrderStore>} store
 * @param {Date} [now]
 */
export function todaySoFar(store, now = new Date()) {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const orders = store.all().filter((o) => {
    const at = Date.parse(o.placedAt);
    return o.status !== 'cancelled' && at >= start.getTime() && at <= now.getTime();
  });
  return { orders: orders.length, revenueCents: orders.reduce((sum, o) => sum + o.totalCents, 0) };
}
