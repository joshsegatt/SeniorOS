import { readFileSync } from 'node:fs';
import { parseSwissDate } from '../ledger/dates.js';
import { parseAmount } from '../ledger/money.js';
import { addTransaction } from '../ledger/transactions.js';

const HEADER = 'Date,Description,Amount,Currency';

/**
 * Imports a CSV statement exported from Alpstein Bank e-banking. Returns how many transactions it added.
 * @param {ReturnType<import('../ledger/store.js').createLedger>} ledger
 * @param {string} file
 */
export function importStatement(ledger, file) {
  const lines = readFileSync(file, 'utf8').split('\n');
  if (lines.at(-1) === '') lines.pop();
  if (lines[0] !== HEADER) throw new Error('not an Alpstein Bank statement');
  let imported = 0;
  for (const line of lines.slice(1)) {
    const [date, description, amount, currency] = line.split(',');
    addTransaction(ledger, { date: parseSwissDate(date), description, amountCents: parseAmount(amount), currency, source: 'bank-csv' });
    imported += 1;
  }
  return imported;
}
