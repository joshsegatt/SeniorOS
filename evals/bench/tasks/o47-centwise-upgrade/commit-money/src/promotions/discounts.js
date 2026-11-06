import { percentOf } from '../../vendor/centwise/index.js';

/** Codes the marketing team hands out, in percent off the cart subtotal. */
export const CODES = { WELCOME10: 10, AUTUMN15: 15, STAFF30: 30 };

/**
 * Apply a percentage code to a cart subtotal.
 * @param {number} subtotalCents
 * @param {string} code
 */
export function applyCode(subtotalCents, code) {
  const pct = CODES[code.trim().toUpperCase()];
  if (pct === undefined) return { ok: false, error: 'unknown code' };
  const discountCents = percentOf(subtotalCents, pct);
  return { ok: true, discountCents, totalCents: subtotalCents - discountCents };
}
