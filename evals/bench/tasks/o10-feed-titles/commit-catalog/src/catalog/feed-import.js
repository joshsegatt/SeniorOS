import { escapeHtml } from '../lib/html.js';

/**
 * Nightly import of the supplier's product feed (rows already parsed from their XML).
 * Titles come from the supplier's system, so they are escaped before they go into our catalog.
 * Prices are in euros with two decimals.
 * @param {ReturnType<import('./store.js').createCatalog>} catalog
 * @param {{ ref: string, title: string, price: string }[]} rows
 */
export function importSupplierFeed(catalog, rows) {
  const result = { created: 0, updated: 0, skipped: 0 };
  for (const row of rows) {
    const sku = String(row.ref ?? '').trim().toUpperCase();
    const title = String(row.title ?? '').trim();
    const priceCents = Math.round(Number.parseFloat(row.price) * 100);
    if (!sku || !title || !Number.isFinite(priceCents) || priceCents <= 0) {
      result.skipped += 1;
      continue;
    }
    const existing = catalog.get(sku);
    if (existing && existing.source === 'admin') {
      result.skipped += 1;
      continue;
    }
    catalog.upsert({ sku, name: escapeHtml(title), priceCents, source: 'feed' });
    result[existing ? 'updated' : 'created'] += 1;
  }
  return result;
}
