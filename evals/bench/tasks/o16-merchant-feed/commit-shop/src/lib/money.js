import { config } from '../config.js';

/**
 * A price as shoppers see it, in the shop's currency and locale.
 * @param {number} amount integer amount in the minor unit of the shop currency
 */
export function formatPrice(amount) {
  const format = new Intl.NumberFormat(config.shop.locale, { style: 'currency', currency: config.shop.currency });
  const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
  return format.format(amount / 10 ** digits);
}
