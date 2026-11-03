/**
 * Applies the supplier's weekly cost price list (CSV: sku;description;cost_eur, decimal comma).
 * @param {string} csvText
 * @param {ReturnType<typeof import('./catalog.js').createCatalog>} catalog
 * @returns {{ updated: number, unknown: string[] }}
 */
export function applySupplierCosts(csvText, catalog) {
  const [, ...lines] = csvText.split(/\r?\n/).filter((line) => line.trim() !== '');
  let updated = 0;
  /** @type {string[]} */
  const unknown = [];
  for (const line of lines) {
    const cells = line.split(';').map((c) => c.trim());
    const sku = cells[0].toUpperCase();
    const costCents = Math.round(Number.parseFloat(cells[cells.length - 1].replace(',', '.')) * 100);
    if (!sku || !Number.isFinite(costCents)) continue;
    if (!catalog.findBySku(sku)) {
      unknown.push(sku);
      continue;
    }
    catalog.update(sku, { costCents });
    updated += 1;
  }
  return { updated, unknown };
}
