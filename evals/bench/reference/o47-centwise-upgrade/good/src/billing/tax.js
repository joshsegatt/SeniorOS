import { percent } from '../../vendor/centwise/index.js';

/** VAT rates in percent. */
export const VAT_RATES = { standard: 21, reduced: 9, zero: 0 };

/**
 * VAT on a net amount, per invoice line.
 * @param {number} netCents
 * @param {keyof typeof VAT_RATES} [rate]
 */
export function vatFor(netCents, rate = 'standard') {
  const pct = VAT_RATES[rate];
  if (pct === undefined) throw new RangeError(`unknown VAT rate "${rate}"`);
  return percent(netCents, pct, { rounding: 'half-up' });
}
