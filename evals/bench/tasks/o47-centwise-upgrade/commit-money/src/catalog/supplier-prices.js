import { fromDecimal } from '../../vendor/centwise/index.js';

/**
 * The supplier's price list (JSON, prices in euros as decimals): [{ "sku": "TEA-001", "price": 19.99 }, ...].
 * Our retail price is the supplier price; the catalog stores integer cents.
 * @param {{ sku: string, price: number | string }[]} list
 * @returns {Map<string, number>} sku -> price in cents
 */
export function importSupplierPrices(list) {
  const prices = new Map();
  for (const item of list) {
    if (!item.sku || item.price === undefined || item.price === null || item.price === '') continue;
    prices.set(item.sku, fromDecimal(item.price));
  }
  return prices;
}
