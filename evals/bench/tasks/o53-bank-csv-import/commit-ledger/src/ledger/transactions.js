import { categorize } from './categories.js';

/** @typedef {ReturnType<import('./store.js').createLedger>} Ledger */

export const CURRENCIES = ['CHF', 'EUR'];

/**
 * The one way a transaction gets into the ledger: every form and importer goes through here.
 * @param {Ledger} ledger
 * @param {{ date: string, description: string, amountCents: number, currency: string, source: string }} input
 */
export function addTransaction(ledger, input) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input.date))) throw new Error(`invalid date ${JSON.stringify(input.date)}`);
  const description = String(input.description ?? '').trim();
  if (!description) throw new Error('description is required');
  if (!Number.isInteger(input.amountCents) || input.amountCents === 0) throw new Error('amount must be a non-zero number of cents');
  if (!CURRENCIES.includes(input.currency)) throw new Error(`unsupported currency ${JSON.stringify(input.currency)}`);
  if (!input.source) throw new Error('source is required');
  return ledger.insert({
    date: input.date,
    description,
    amountCents: input.amountCents,
    currency: input.currency,
    category: categorize(description),
    source: input.source,
  });
}
