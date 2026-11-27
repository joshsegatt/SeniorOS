import { eachRow } from '../lib/paginate.js';

// Nightly reconciliation: per-account balance and row count, compared later
// with the bank's closing balances.
export function reconcile(store, { pageSize = 200 } = {}) {
  const balances = {};
  let rows = 0;
  for (const tx of eachRow(store, { pageSize, order: 'asc' })) {
    balances[tx.accountId] = (balances[tx.accountId] ?? 0) + tx.amountCents;
    rows += 1;
  }
  return { rows, balances };
}
