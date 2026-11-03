export class NoRates extends Error {
  /** @param {string} day */
  constructor(day) {
    super(`no reference rates published on ${day}`);
    this.day = day;
  }
}

/**
 * Client for the exchange-rate service (ECB reference rates, base EUR). Config: config/rates-api.json.
 * `http.getJson(path)` resolves to { status, body }.
 * @param {{ getJson(path: string): Promise<{ status: number, body: any }> }} http
 */
export function createRatesClient(http) {
  return {
    /**
     * The reference rates published on `day`: { date, base: 'EUR', rates: { USD: 1.0832, ... } }, where
     * 1 EUR = rates[currency] units of that currency. Throws NoRates on days without a fixing
     * (weekends and TARGET holidays).
     * @param {string} day 'YYYY-MM-DD'
     */
    async ratesOn(day) {
      const res = await http.getJson(`/v1/reference/${day}?base=EUR`);
      if (res.status === 404) throw new NoRates(day);
      if (res.status !== 200) throw new Error(`rates service answered ${res.status} for ${day}`);
      return res.body;
    },
  };
}
