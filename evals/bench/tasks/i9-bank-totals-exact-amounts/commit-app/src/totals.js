import { normalizeStatement } from './statement.js';

// statements: [{ source, rows }]
// Returns { 'YYYY-MM': { CUR: totalInMinorUnits } }.
export function monthlyTotals(statements) {
  const totals = {};
  for (const statement of statements) {
    for (const tx of normalizeStatement(statement)) {
      const month = (totals[tx.month] ??= {});
      month[tx.currency] = (month[tx.currency] ?? 0) + tx.amount;
    }
  }
  for (const month of Object.values(totals)) {
    for (const currency of Object.keys(month)) {
      month[currency] = Math.round(month[currency] * 100);
    }
  }
  return totals;
}
