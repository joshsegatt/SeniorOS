import { formatCents, isoDate } from '../format/money.js';
import { eachRow } from '../lib/paginate.js';
import { toCsv } from './csv.js';

export const EXPORT_HEADER = ['id', 'booked_at', 'account', 'amount', 'memo'];

// Exports stream the ledger page by page so a big year does not have to be
// materialised twice in memory.
export function exportLedgerCsv(store, { pageSize = 50, accountId = null } = {}) {
  const rows = [];
  for (const tx of eachRow(store, { pageSize, order: 'asc', accountId })) {
    rows.push([tx.id, isoDate(tx.bookedAt), tx.accountId, formatCents(tx.amountCents), tx.memo]);
  }
  return toCsv(EXPORT_HEADER, rows);
}
