/**
 * Formats an amount in cents for display.
 * @param {number} cents
 * @param {string} [currency]
 */
export function formatMoney(cents, currency = 'CHF') {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}
