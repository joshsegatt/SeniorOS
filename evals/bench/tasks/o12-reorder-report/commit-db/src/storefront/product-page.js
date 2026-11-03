import { getProduct } from '../catalog/products.js';
import { getStockLevel } from '../inventory/stock.js';

/**
 * Data for the product page.
 * @param {import('../db/memory.js').Db} db
 * @param {string} sku
 */
export async function productPage(db, sku) {
  const product = await getProduct(db, sku);
  if (!product || !product.active) return null;
  const onHand = await getStockLevel(db, sku);
  return { sku: product.sku, name: product.name, inStock: onHand > 0, lowStock: onHand > 0 && onHand <= 3 };
}
