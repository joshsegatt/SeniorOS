import { orderTotal } from '../orders/orders.js';

const SHOP_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' });

/** @param {string} iso */
function shopDay(iso) {
  return SHOP_DAY.format(new Date(iso));
}

/** @param {unknown} value @param {string} name */
function parseDay(value, name) {
  if (value === undefined || value === null || value === '') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  const d = m && new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (!m || !d || d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) {
    throw new RangeError(`${name} must be a date as YYYY-MM-DD, got ${JSON.stringify(value)}`);
  }
  return String(value);
}

/** @param {unknown} value */
function csvField(value) {
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Orders as CSV for accounting.
 * @param {import('../orders/orders.js').Order[]} orders
 * @param {{ from?: string, to?: string, includeCancelled?: boolean | string }} [options]
 */
export function exportOrdersCsv(orders, options = {}) {
  const from = parseDay(options.from, 'from');
  const to = parseDay(options.to, 'to');
  if (from && to && from > to) throw new RangeError('from must be on or before to');
  const includeCancelled = options.includeCancelled === true || options.includeCancelled === 'true';

  const lines = orders
    .filter((o) => includeCancelled || o.status !== 'cancelled')
    .map((o) => ({ order: o, day: shopDay(o.placedAt) }))
    .filter(({ day }) => (!from || day >= from) && (!to || day <= to))
    .sort((a, b) => Date.parse(a.order.placedAt) - Date.parse(b.order.placedAt))
    .map(({ order, day }) => {
      const items = order.lines.reduce((n, l) => n + l.qty, 0);
      const total = (orderTotal(order) / 100).toFixed(2);
      return [order.id, day, order.customerName, items, total].map(csvField).join(',');
    });
  return `${['id,date,customer,items,total', ...lines].join('\n')}\n`;
}
