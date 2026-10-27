/** VAT/sales tax by region, in per mille. */
const TAX_RATES = { CH: 81, DE: 190, US: 0 };

/**
 * Price including tax, in cents.
 * @param {number} cents
 * @param {keyof typeof TAX_RATES} region
 */
export function priceWithTax(cents, region) {
  const rate = TAX_RATES[region];
  if (rate === undefined) throw new Error(`Unknown region: ${region}`);
  return Math.round(cents * (1 + rate / 1000));
}
