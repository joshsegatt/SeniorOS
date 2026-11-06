import { formatAmount } from './units.js';

/**
 * Rows of the merchant feed (uploaded nightly to the price-comparison sites). Only active products are listed.
 * The column names and formats are fixed by the feed spec: price "14.90 EUR", shipping_weight "0.42 kg".
 * @param {ReturnType<import('./store.js').createCatalog>} catalog
 */
export function feedRows(catalog) {
  return catalog
    .all()
    .filter((p) => p.active)
    .sort((a, b) => a.sku.localeCompare(b.sku))
    .map((p) => ({
      id: p.sku,
      title: p.title,
      price: `${formatAmount(p.priceCents)} EUR`,
      shipping_weight: `${p.weightGrams / 1000} kg`,
    }));
}
