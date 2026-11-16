import { formatMoney } from '../ledger/money.js';

/**
 * The monthly summary on the dashboard (CHF transactions only for now).
 * @param {ReturnType<import('../ledger/store.js').createLedger>} ledger
 * @param {string} month "2026-10"
 */
export function monthlySummary(ledger, month) {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error('month must look like 2026-10');
  const txs = ledger.transactions().filter((t) => t.currency === 'CHF' && t.date.startsWith(`${month}-`));
  const incomeCents = txs.filter((t) => t.amountCents > 0).reduce((s, t) => s + t.amountCents, 0);
  const spentCents = txs.filter((t) => t.amountCents < 0).reduce((s, t) => s - t.amountCents, 0);
  /** @type {Record<string, number>} */
  const byCategory = {};
  for (const t of txs.filter((t) => t.amountCents < 0)) byCategory[t.category] = (byCategory[t.category] ?? 0) - t.amountCents;
  return {
    month,
    transactions: txs.length,
    income: formatMoney(incomeCents),
    spent: formatMoney(spentCents),
    net: formatMoney(incomeCents - spentCents),
    byCategory: Object.fromEntries(Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([c, v]) => [c, formatMoney(v)])),
  };
}
