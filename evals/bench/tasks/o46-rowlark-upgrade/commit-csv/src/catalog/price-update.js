import rowlark from '../../vendor/rowlark/index.js';

/**
 * Price update sheet from the merchandising team: comma-separated, header `sku,priceCents`.
 * A row is applied only when its price is a whole, positive number of cents.
 * @param {string} text
 */
export function readPriceUpdate(text) {
  const updates = [];
  const rejected = [];
  rowlark.parse(text).forEach((row, i) => {
    const line = i + 2;
    if (!row.sku || !Number.isInteger(row.priceCents) || row.priceCents <= 0) rejected.push({ line, sku: row.sku || null });
    else updates.push({ sku: String(row.sku), priceCents: row.priceCents });
  });
  return { updates, rejected };
}

/** Apply the accepted updates to a catalog Map(sku -> { priceCents }). Unknown SKUs are reported, not created. */
export function applyPriceUpdate(catalog, text) {
  const { updates, rejected } = readPriceUpdate(text);
  const unknown = [];
  for (const u of updates) {
    const product = catalog.get(u.sku);
    if (product) product.priceCents = u.priceCents;
    else unknown.push(u.sku);
  }
  return { applied: updates.length - unknown.length, rejected, unknown };
}
