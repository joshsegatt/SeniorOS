import { listActiveProducts } from '../catalog/products.js';
import { getStockLevel } from '../inventory/stock.js';
import { getSupplier } from './suppliers.js';

/**
 * Active products at or below their reorder point, with the supplier to order from.
 * @param {import('../db/memory.js').Db} db
 */
export async function buildReorderReport(db) {
  const products = await listActiveProducts(db);
  const levels = await Promise.all(products.map((p) => getStockLevel(db, p.sku)));
  const low = products.map((p, i) => ({ product: p, onHand: levels[i] })).filter(({ product, onHand }) => onHand <= product.reorderPoint);

  /** @type {Map<string, Promise<import('./suppliers.js').Supplier | null>>} */
  const supplierCache = new Map();
  const supplierOf = (id) => {
    if (!supplierCache.has(id)) supplierCache.set(id, getSupplier(db, id));
    return supplierCache.get(id);
  };
  const rows = await Promise.all(low.map(async ({ product, onHand }) => {
    const supplier = await supplierOf(product.supplierId);
    return { sku: product.sku, name: product.name, onHand, reorderPoint: product.reorderPoint, supplierName: supplier?.name ?? null, supplierEmail: supplier?.email ?? null };
  }));
  return rows.sort((a, b) => String(a.supplierName).localeCompare(String(b.supplierName)) || a.sku.localeCompare(b.sku));
}
