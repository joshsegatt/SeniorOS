import { shopDay } from '../lib/dates.js';

/**
 * Orders placed today so far (the shop's day, in its time zone), not counting cancelled ones.
 * @param {ReturnType<import('../orders/store.js').createOrderStore>} store
 * @param {Date} [now]
 */
export function todaySoFar(store, now = new Date()) {
  const today = shopDay(now);
  const orders = store.all().filter((o) => o.status !== 'cancelled' && shopDay(new Date(o.placedAt)) === today);
  return { orders: orders.length, revenueCents: orders.reduce((sum, o) => sum + o.totalCents, 0) };
}
