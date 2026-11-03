/**
 * Dev data shaped like a production quarter of card transactions (about 42k a quarter, 13 countries).
 * @typedef {{ id: string, date: string, country: string, currency: string, amount: number }} Transaction
 */
export const MARKETS = [
  ['DE', 'EUR'], ['FR', 'EUR'], ['ES', 'EUR'], ['IT', 'EUR'],
  ['US', 'USD'], ['GB', 'GBP'], ['CH', 'CHF'], ['SE', 'SEK'], ['PL', 'PLN'],
  ['DK', 'DKK'], ['CZ', 'CZK'], ['JP', 'JPY'], ['CA', 'CAD'],
];

/**
 * @param {{ from?: string, days?: number, perDay?: number }} [options]
 * @returns {Transaction[]}
 */
export function quarterTransactions({ from = '2026-07-01', days = 92, perDay = 460 } = {}) {
  const out = [];
  const start = Date.parse(`${from}T00:00:00Z`);
  let n = 0;
  for (let d = 0; d < days; d += 1) {
    const date = new Date(start + d * 86_400_000).toISOString().slice(0, 10);
    for (let i = 0; i < perDay; i += 1) {
      const [country, currency] = MARKETS[(n * 7 + d) % MARKETS.length];
      const scale = currency === 'JPY' ? 150 : currency === 'SEK' || currency === 'DKK' || currency === 'CZK' ? 10 : 1;
      out.push({ id: `tx-${n}`, date, country, currency, amount: Math.round((9.9 + ((n * 37) % 400) * 0.73) * scale * 100) / 100 });
      n += 1;
    }
  }
  return out;
}
