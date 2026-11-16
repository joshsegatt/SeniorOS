import { parseSwissDate } from './dates.js';
import { parseAmount } from './money.js';
import { addTransaction } from './transactions.js';

/**
 * The "add payment" form: date as DD.MM.YYYY, amount in francs ("-23.80").
 * @param {ReturnType<import('./store.js').createLedger>} ledger
 * @param {{ date: string, description: string, amount: string, currency?: string }} form
 */
export function addManualEntry(ledger, form) {
  return addTransaction(ledger, {
    date: parseSwissDate(form.date),
    description: form.description,
    amountCents: parseAmount(form.amount),
    currency: form.currency ?? 'CHF',
    source: 'manual',
  });
}
