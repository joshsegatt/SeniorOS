import { NoRates } from './rates.js';

/** @param {number} value */
export function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** @param {string} day */
export function previousDay(day) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * The EUR reference rate for `currency` that applies on `day`: the latest one published on or before it.
 * @param {ReturnType<import('./rates.js').createRatesClient>} rates
 * @param {string} currency
 * @param {string} day
 */
export async function rateFor(rates, currency, day) {
  let d = day;
  for (let i = 0; i < 10; i += 1) {
    try {
      const table = await rates.ratesOn(d);
      const rate = table.rates[currency];
      if (!rate) throw new Error(`no ${currency} reference rate`);
      return rate;
    } catch (err) {
      if (!(err instanceof NoRates)) throw err;
      d = previousDay(d);
    }
  }
  throw new Error(`no reference rate for ${currency} in the 10 days up to ${day}`);
}

/**
 * Converts an amount to EUR at the reference rate of the given day, rounded to cents.
 * @param {ReturnType<import('./rates.js').createRatesClient>} rates
 * @param {number} amount
 * @param {string} currency ISO 4217
 * @param {string} day 'YYYY-MM-DD'
 */
export async function toEur(rates, amount, currency, day) {
  if (currency === 'EUR') return round2(amount);
  return round2(amount / (await rateFor(rates, currency, day)));
}
