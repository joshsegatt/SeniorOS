import { monthRange } from './dates.js';
import { toOrder } from './orders.js';

/** @param {unknown} value */
function cell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Last month's orders for accounting's bookkeeping import.
 * Follows the API's cursors directly: api.ordersPage(n) re-walks pages 1..n-1 on every call.
 * @param {ReturnType<import('./api.js').createShopApi>} api
 * @param {string} month 'YYYY-MM'
 */
export async function exportOrders(api, month) {
  const range = monthRange(month);
  const lines = ['number,date,email,net,vat,gross,status'];
  let cursor = null;
  do {
    const res = await api.listOrders({ ...range, cursor });
    for (const o of res.data.map(toOrder)) {
      lines.push([o.number, o.createdAt, o.email, o.net.toFixed(2), o.vat.toFixed(2), o.gross.toFixed(2), o.status].map(cell).join(','));
    }
    cursor = res.next_cursor;
  } while (cursor);
  return lines.join('\n') + '\n';
}
