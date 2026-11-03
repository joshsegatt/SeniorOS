import { toCents } from '../lib/money.js';

/**
 * Applies a supplier cost list (the monthly file from ACME, sample in data/) to our products.
 * @returns {{ updated: number, unknown: string[] }}
 */
export function importSupplierCosts(products, csv) {
  const [header, ...rows] = csv.trim().split(/\r?\n/);
  const columns = header.split(';').map((c) => c.trim().toLowerCase());
  const skuAt = columns.indexOf('sku');
  const costAt = columns.indexOf('cost');
  if (skuAt === -1 || costAt === -1) throw new Error('the file needs sku and cost columns');

  let updated = 0;
  const unknown = [];
  for (const row of rows) {
    if (!row.trim()) continue;
    const fields = row.split(';');
    const product = products.get(fields[skuAt].trim());
    if (!product) {
      unknown.push(fields[skuAt].trim());
      continue;
    }
    // ACME writes decimals with a comma (3,85).
    product.costCents = toCents(fields[costAt].trim().replace(',', '.'));
    updated += 1;
  }
  return { updated, unknown };
}

/** Margin per product in cents, for the monthly report. */
export function margins(products) {
  return [...products.entries()]
    .filter(([, p]) => p.costCents != null)
    .map(([id, p]) => ({ id, marginCents: p.priceCents - p.costCents }));
}
