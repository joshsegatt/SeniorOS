import { loadOrders } from './archive.js';
import { orderTotal } from './orders.js';

/**
 * Revenue in cents of the orders placed in a month, from the archive.
 * @param {string} dir the archive folder
 * @param {string} month e.g. "2026-10"
 */
export function monthlyRevenue(dir, month) {
  return loadOrders(dir)
    .filter((order) => order.placedAt.startsWith(month))
    .reduce((sum, order) => sum + orderTotal(order.lines, order.region), 0);
}
