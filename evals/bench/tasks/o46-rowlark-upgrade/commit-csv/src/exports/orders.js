import rowlark from '../../vendor/rowlark/index.js';
import { centsToDecimal } from '../lib/cents.js';

const COLUMNS = ['id', 'date', 'customer', 'total', 'note'];

/**
 * Orders export opened by the shop team in a spreadsheet. `note` is the free-text note the customer typed at checkout.
 * @param {{ id: string, placedAt: string, customerEmail: string, totalCents: number, note?: string }[]} orders
 */
export function ordersCsv(orders) {
  const rows = orders.map((o) => ({
    id: o.id,
    date: o.placedAt.slice(0, 10),
    customer: o.customerEmail,
    total: centsToDecimal(o.totalCents),
    note: o.note ?? '',
  }));
  return rowlark.stringify(rows, { columns: COLUMNS });
}
