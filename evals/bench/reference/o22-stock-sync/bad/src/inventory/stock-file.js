/**
 * Applies the warehouse's nightly stock file (CSV: sku,qty).
 * @param {ReturnType<import('./catalog.js').openCatalog>} catalog
 * @param {string} csvText
 * @returns {Promise<{ updated: number, unknown: string[] }>}
 */
export async function applyStockFile(catalog, csvText) {
  const [, ...rows] = csvText.split(/\r?\n/).filter((line) => line.trim() !== '');
  let updated = 0;
  const unknown = [];
  for (const row of rows) {
    const [sku, qtyText] = row.split(',').map((cell) => cell.trim());
    const qty = Number(qtyText);
    if (!sku || !Number.isInteger(qty) || qty < 0) continue;
    if (!catalog.has(sku)) {
      unknown.push(sku);
      continue;
    }
    catalog.setStock(sku, qty);
    updated += 1;
  }
  return { updated, unknown };
}
