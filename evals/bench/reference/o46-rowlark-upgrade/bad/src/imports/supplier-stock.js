import * as rowlark from '../../vendor/rowlark/index.js';

/**
 * The supplier's nightly stock file: semicolon-separated, header `sku;bin;qty`, one row per warehouse bin, so the
 * same SKU appears once per bin.
 * @param {string} text
 * @returns {Map<string, number>} units available per SKU
 */
export function supplierStock(text) {
  const stock = new Map();
  for (const row of rowlark.parse(text, { delimiter: ';' })) {
    if (!row.sku) continue;
    stock.set(row.sku, (stock.get(row.sku) ?? 0) + row.qty);
  }
  return stock;
}

/** SKUs whose supplier stock is below `threshold` units. */
export function lowStock(text, threshold = 5) {
  return [...supplierStock(text)].filter(([, qty]) => qty < threshold).map(([sku]) => sku).sort();
}
