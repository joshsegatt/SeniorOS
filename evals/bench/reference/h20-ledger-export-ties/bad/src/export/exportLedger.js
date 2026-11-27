import { formatCents, isoDate } from '../format/money.js';
import { toCsv } from './csv.js';

export const EXPORT_HEADER = ['id', 'booked_at', 'account', 'amount', 'memo'];

// Tempting shallow fix: stop paging in the export and read everything at once.
export function exportLedgerCsv(store, { accountId = null } = {}) {
  const rows = store
    .all()
    .filter((tx) => !accountId || tx.accountId === accountId)
    .sort((a, b) => a.bookedAt - b.bookedAt)
    .map((tx) => [tx.id, isoDate(tx.bookedAt), tx.accountId, formatCents(tx.amountCents), tx.memo]);
  return toCsv(EXPORT_HEADER, rows);
}
