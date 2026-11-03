import { listActiveProducts } from '../catalog/products.js';

/**
 * Active products at or below their reorder point, with the supplier to order from.
 * Three queries in all: each db call is a round trip, and the catalog has thousands of products.
 * @param {import('../db/memory.js').Db} db
 */
export async function buildReorderReport(db) {
  const products = await listActiveProducts(db);
  const stockDocs = await db.find('stock', { sku: { $in: products.map((p) => p.sku) } });
  const onHand = new Map(stockDocs.map((s) => [s.sku, Number(s.onHand)]));
  const low = products.filter((p) => (onHand.get(p.sku) ?? 0) <= p.reorderPoint);
  const supplierIds = [...new Set(low.map((p) => p.supplierId))];
  const suppliers = supplierIds.length ? await db.find('suppliers', { id: { $in: supplierIds } }) : [];
  const byId = new Map(suppliers.map((s) => [s.id, s]));
  const rows = low.map((p) => {
    const s = byId.get(p.supplierId);
    return { sku: p.sku, name: p.name, onHand: onHand.get(p.sku) ?? 0, reorderPoint: p.reorderPoint, supplierName: s ? String(s.name) : null, supplierEmail: s ? String(s.email) : null };
  });
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  return rows.sort((a, b) => cmp(a.supplierName ?? '', b.supplierName ?? '') || cmp(a.sku, b.sku));
}
