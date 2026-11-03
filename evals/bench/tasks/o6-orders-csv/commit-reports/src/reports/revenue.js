import { orderTotal } from '../orders/orders.js';

/**
 * Revenue per calendar month (UTC), oldest month first. Cancelled orders do not count.
 * @param {import('../orders/orders.js').Order[]} orders
 * @returns {{ month: string, orders: number, revenueCents: number }[]}
 */
export function revenueByMonth(orders) {
  /** @type {Map<string, { month: string, orders: number, revenueCents: number }>} */
  const months = new Map();
  for (const order of orders) {
    if (order.status === 'cancelled') continue;
    const month = order.placedAt.slice(0, 7);
    const row = months.get(month) ?? { month, orders: 0, revenueCents: 0 };
    row.orders += 1;
    row.revenueCents += orderTotal(order);
    months.set(month, row);
  }
  return [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
}
