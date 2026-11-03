/**
 * Price list upload from the back office: one `productId,priceCents` per line. Lines for unknown products are
 * reported, not applied.
 * @param {ReturnType<import('./db.js').createDb>} db
 * @param {string} csv
 */
export function importPrices(db, csv) {
  const result = { updated: 0, errors: /** @type {string[]} */ ([]) };
  for (const [i, raw] of csv.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [id, cents] = line.split(',').map((s) => s.trim());
    const priceCents = Number(cents);
    if (!Number.isInteger(priceCents) || priceCents < 0) {
      result.errors.push(`line ${i + 1}: bad price`);
      continue;
    }
    try {
      db.setPrice(id, priceCents);
      result.updated += 1;
    } catch {
      result.errors.push(`line ${i + 1}: unknown product ${id}`);
    }
  }
  return result;
}
