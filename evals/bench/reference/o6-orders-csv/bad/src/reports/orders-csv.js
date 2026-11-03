import { orderTotal } from '../orders/orders.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** @param {string} iso */
function zurichDay(iso) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

/** @param {string | undefined} value @param {string} name */
function checkDay(value, name) {
  if (value === undefined) return;
  if (!DAY.test(value) || Number.isNaN(Date.parse(value))) throw new RangeError(`invalid ${name} date: ${value}`);
}

/** @param {unknown} value */
function escapeCsv(value) {
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * @param {import('../orders/orders.js').Order[]} orders
 * @param {{ from?: string, to?: string, includeCancelled?: boolean }} [options]
 */
export function exportOrdersCsv(orders, { from, to, includeCancelled = false } = {}) {
  checkDay(from, 'from');
  checkDay(to, 'to');
  if (from && to && from > to) throw new RangeError('from must not be after to');
  const rows = orders
    .filter((o) => includeCancelled || o.status !== 'cancelled')
    .filter((o) => {
      const day = zurichDay(o.placedAt);
      return (!from || day >= from) && (!to || day <= to);
    })
    .sort((a, b) => a.placedAt.localeCompare(b.placedAt))
    .map((o) => [o.id, zurichDay(o.placedAt), o.customerName, o.lines.reduce((n, l) => n + l.qty, 0), (orderTotal(o) / 100).toFixed(2)].map(escapeCsv).join(','));
  return ['id,date,customer,items,total', ...rows].join('\n') + '\n';
}
