import { roundHalfUp } from './money.js';

// VAT rates in basis points (810 = 8.10 %).
const RATES_BP = Object.freeze({ CH: 810, DE: 1900, FR: 2000, AT: 2000 });

export function rateFor(country) {
  const rate = RATES_BP[country];
  if (rate === undefined) throw new RangeError(`no VAT rate for country ${country}`);
  return rate;
}

/** Tax on an amount in cents at a rate in basis points, rounded half up. */
export function taxOn(amountCents, rateBp) {
  return roundHalfUp(amountCents * rateBp, 10000);
}
