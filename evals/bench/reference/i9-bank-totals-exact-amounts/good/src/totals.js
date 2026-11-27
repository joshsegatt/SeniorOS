import { normalizeStatement } from './statement.js';

// statements: [{ source, rows }]
// Returns { 'YYYY-MM': { CUR: totalInMinorUnits } }. Sums integers only, so the
// totals are exact to the cent.
export function monthlyTotals(statements) {
  const totals = {};
  for (const statement of statements) {
    for (const tx of normalizeStatement(statement)) {
      const month = (totals[tx.month] ??= {});
      month[tx.currency] = (month[tx.currency] ?? 0) + tx.amountMinor;
    }
  }
  return totals;
}
