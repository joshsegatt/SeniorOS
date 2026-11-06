import { tryParse } from '../../vendor/centwise/index.js';

const MAX_ADJUSTMENT_CENTS = 50000;

/**
 * The amount field of the support tool's "goodwill credit" form, as typed by the agent ("12,50", "€ 5").
 * @param {string} input
 * @returns {{ ok: true, cents: number } | { ok: false, error: string }}
 */
export function parseAmountField(input) {
  const cents = tryParse(input);
  if (cents === null) return { ok: false, error: 'invalid amount' };
  if (cents <= 0) return { ok: false, error: 'amount must be positive' };
  if (cents > MAX_ADJUSTMENT_CENTS) return { ok: false, error: 'amount above the goodwill limit' };
  return { ok: true, cents };
}

/**
 * Handle a submitted goodwill credit form. Returns the credit to save, or the form error to show next to the field.
 * @param {{ customerId: string, amount: string, reason: string, agent: string }} form
 */
export function createGoodwillCredit(form) {
  const amount = parseAmountField(form.amount);
  if (!amount.ok) return { ok: false, field: 'amount', error: amount.error };
  if (!form.reason?.trim()) return { ok: false, field: 'reason', error: 'reason is required' };
  return { ok: true, credit: { customerId: form.customerId, cents: amount.cents, reason: form.reason.trim(), agent: form.agent } };
}
