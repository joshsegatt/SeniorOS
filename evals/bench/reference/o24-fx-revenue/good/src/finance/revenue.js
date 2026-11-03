import { toEur } from '../fx/convert.js';

/**
 * Revenue per country in EUR, each transaction converted like invoices are (toEur, reference rate of its day).
 * The rate service has a small daily quota and one published table holds every currency, so tables are
 * fetched once per day (weekend lookups then hit the cached Friday).
 * @param {ReturnType<import('../fx/rates.js').createRatesClient>} rates
 * @param {import('./sample.js').Transaction[]} transactions
 * @returns {Promise<Record<string, number>>}
 */
export async function revenueByCountry(rates, transactions) {
  /** @type {Map<string, Promise<any>>} */
  const tables = new Map();
  const cached = {
    /** @param {string} day */
    ratesOn(day) {
      if (!tables.has(day)) tables.set(day, rates.ratesOn(day));
      return /** @type {Promise<any>} */ (tables.get(day));
    },
  };
  /** @type {Record<string, number>} */
  const cents = {};
  for (const t of transactions) {
    const eur = await toEur(/** @type {any} */ (cached), t.amount, t.currency, t.date);
    cents[t.country] = (cents[t.country] ?? 0) + Math.round(eur * 100);
  }
  return Object.fromEntries(Object.entries(cents).map(([country, c]) => [country, c / 100]));
}
