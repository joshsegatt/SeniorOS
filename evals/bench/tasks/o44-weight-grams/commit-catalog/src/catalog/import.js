import { parseKg, toCents } from './units.js';

/**
 * The supplier's nightly CSV: `sku,title,price,weight_kg`, prices in euros, weights in kilograms.
 * New skus are created, known skus get the supplier's title, price and weight.
 * @param {ReturnType<import('./store.js').createCatalog>} catalog
 * @param {string} csv
 * @param {() => Date} [now]
 */
export function importSupplierCsv(catalog, csv, now = () => new Date()) {
  const [header, ...lines] = csv.trim().split(/\r?\n/);
  const columns = header.split(',').map((c) => c.trim());
  const result = { created: 0, updated: 0, skipped: /** @type {string[]} */ ([]) };
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells = line.split(',');
    const row = Object.fromEntries(columns.map((c, i) => [c, (cells[i] ?? '').trim()]));
    const sku = row.sku.toUpperCase();
    const priceCents = toCents(row.price);
    const weightKg = parseKg(row.weight_kg);
    if (!sku || !row.title || !(priceCents > 0) || !(weightKg > 0)) {
      result.skipped.push(sku || line);
      continue;
    }
    const saved = catalog.raw(sku);
    catalog.put({ ...(saved ?? { sku, active: true }), title: row.title, priceCents, weightKg, updatedAt: now().toISOString() });
    if (saved) result.updated += 1;
    else result.created += 1;
  }
  return result;
}
