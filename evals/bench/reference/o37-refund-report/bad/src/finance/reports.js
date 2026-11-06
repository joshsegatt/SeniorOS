import { formatEuros, toCents } from './money.js';

/** @typedef {ReturnType<import('./store.js').createPaymentsStore>} PaymentsStore */

/** @param {string} iso @param {string} month "2026-10" */
const inMonth = (iso, month) => iso.slice(0, 7) === month;

/** Refunds from the support tool carry `amount` in euros instead of amountCents. @param {Record<string, unknown>} r */
function refundCents(r) {
  if (typeof r.amountCents === 'number') return r.amountCents;
  return r.amount != null ? toCents(/** @type {string} */ (r.amount)) : 0;
}

/** Total refunded in a month, in cents. @param {PaymentsStore} store @param {string} month "2026-10" */
export function refundsTotal(store, month) {
  return store
    .refunds()
    .filter((r) => inMonth(r.createdAt, month))
    .reduce((sum, r) => sum + refundCents(r), 0);
}

/** The monthly finance report. @param {PaymentsStore} store @param {string} month "2026-10" */
export function monthlyReport(store, month) {
  const charges = store
    .payments()
    .filter((p) => inMonth(p.capturedAt, month))
    .reduce((sum, p) => sum + p.amountCents, 0);
  const refunds = refundsTotal(store, month);
  return { month, charges: formatEuros(charges), refunds: formatEuros(refunds), net: formatEuros(charges - refunds) };
}
