import { shopDay } from '../lib/dates.js';

/**
 * Sales of one day for the accountant: orders not cancelled, by the day they were placed.
 * @param {ReturnType<import('../orders/store.js').createOrderStore>} store
 * @param {string} day YYYY-MM-DD
 */
export function dailySales(store, day) {
  const orders = store.all().filter((o) => o.status !== 'cancelled' && shopDay(new Date(o.placedAt)) === day);
  return { day, orders: orders.length, revenueCents: orders.reduce((sum, o) => sum + o.totalCents, 0) };
}
