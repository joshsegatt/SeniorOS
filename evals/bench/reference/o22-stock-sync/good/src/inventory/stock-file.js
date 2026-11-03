/**
 * Applies the warehouse's nightly stock file (CSV: sku,qty) in one catalog save.
 * @param {ReturnType<import('./catalog.js').openCatalog>} catalog
 * @param {string} csvText
 * @returns {Promise<{ updated: number, unknown: string[] }>}
 */
export async function applyStockFile(catalog, csvText) {
  const [, ...rows] = csvText.split(/\r?\n/).filter((line) => line.trim() !== '');
  /** @type {[string, number][]} */
  const updates = [];
  const unknown = [];
  for (const row of rows) {
    const [sku, qtyText] = row.split(',').map((cell) => cell.trim());
    const qty = Number(qtyText);
    if (!sku || !Number.isInteger(qty) || qty < 0) continue;
    if (!catalog.has(sku)) unknown.push(sku);
    else updates.push([sku, qty]);
  }
  catalog.setStocks(updates);
  return { updated: updates.length, unknown };
}
