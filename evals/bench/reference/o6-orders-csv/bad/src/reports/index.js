import { revenueByMonth } from './revenue.js';
import { topProducts } from './top-products.js';
import { exportOrdersCsv } from './orders-csv.js';

/**
 * Reports offered in the admin "Reports" menu.
 * @typedef {{
 *   id: string,
 *   title: string,
 *   format: 'json' | 'csv',
 *   run: (orders: import('../orders/orders.js').Order[], params: Record<string, any>) => unknown,
 * }} Report
 */

/** @type {Report[]} */
export const reports = [
  { id: 'revenue-monthly', title: 'Revenue by month', format: 'json', run: (orders) => revenueByMonth(orders) },
  { id: 'top-products', title: 'Top products', format: 'json', run: (orders, params) => topProducts(orders, params.limit ?? 10) },
  { id: 'orders-csv', title: 'Orders (CSV)', format: 'csv', run: (orders, params) => exportOrdersCsv(orders, params) },
];

/** @param {string} id */
export function findReport(id) {
  return reports.find((r) => r.id === id) ?? null;
}
