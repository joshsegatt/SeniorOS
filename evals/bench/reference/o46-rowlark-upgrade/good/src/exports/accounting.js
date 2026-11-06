import * as rowlark from '../../vendor/rowlark/index.js';
import { centsToDecimal } from '../lib/cents.js';

const COLUMNS = ['date', 'account', 'description', 'amount'];
const ACCOUNTS = { sale: '8000', refund: '8010', shipping: '8200' };

/**
 * Monthly journal file for the accountant's bookkeeping software. Its importer only reads semicolon-separated files
 * with a decimal comma (`2026-10-02;8000;Order o-1042;24,90`).
 * @param {{ date: string, kind: 'sale' | 'refund' | 'shipping', reference: string, amountCents: number }[]} entries
 */
export function accountingCsv(entries) {
  const rows = entries.map((e) => ({
    date: e.date,
    account: ACCOUNTS[e.kind],
    description: `${e.kind === 'refund' ? 'Refund' : e.kind === 'shipping' ? 'Shipping' : 'Order'} ${e.reference}`,
    amount: centsToDecimal(e.kind === 'refund' ? -Math.abs(e.amountCents) : e.amountCents, { comma: true }),
  }));
  return rowlark.stringify(rows, { separator: ';', columns: COLUMNS });
}
