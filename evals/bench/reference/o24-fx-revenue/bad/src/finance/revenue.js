import { rateFor, round2 } from '../fx/convert.js';

/**
 * Revenue per country in EUR, each transaction converted like invoices are (reference rate of its day).
 * Rates are cached per currency and day: a quarter has ~42k transactions but only ~1k distinct pairs.
 * @param {ReturnType<import('../fx/rates.js').createRatesClient>} rates
 * @param {import('./sample.js').Transaction[]} transactions
 * @returns {Promise<Record<string, number>>}
 */
export async function revenueByCountry(rates, transactions) {
  /** @type {Map<string, number>} */
  const rateCache = new Map();
  /** @type {Record<string, number>} */
  const cents = {};
  for (const t of transactions) {
    let eur;
    if (t.currency === 'EUR') eur = round2(t.amount);
    else {
      const key = `${t.currency}|${t.date}`;
      if (!rateCache.has(key)) rateCache.set(key, await rateFor(rates, t.currency, t.date));
      eur = round2(t.amount / /** @type {number} */ (rateCache.get(key)));
    }
    cents[t.country] = (cents[t.country] ?? 0) + Math.round(eur * 100);
  }
  return Object.fromEntries(Object.entries(cents).map(([country, c]) => [country, c / 100]));
}
