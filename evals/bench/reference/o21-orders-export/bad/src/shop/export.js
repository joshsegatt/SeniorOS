import { monthRange } from './dates.js';
import { listOrders } from './orders.js';

/** @param {unknown} value */
function cell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Last month's orders for accounting's bookkeeping import.
 * @param {ReturnType<import('./api.js').createShopApi>} api
 * @param {string} month 'YYYY-MM'
 */
export async function exportOrders(api, month) {
  const range = monthRange(month);
  const lines = ['number,date,email,net,vat,gross,status'];
  for (let page = 1; ; page += 1) {
    const { orders, hasMore } = await listOrders(api, { ...range, page });
    for (const o of orders) {
      lines.push([o.number, o.createdAt, o.email, o.net.toFixed(2), o.vat.toFixed(2), o.gross.toFixed(2), o.status].map(cell).join(','));
    }
    if (!hasMore) break;
  }
  return lines.join('\n') + '\n';
}
