import { SEP } from './categories.js';

/**
 * Breadcrumbs on the product page: each level links to its category page.
 * @param {ReturnType<import('./db.js').createCatalogDb>} db
 * @param {string} sku
 * @returns {{ name: string, path: string }[]}
 */
export function breadcrumbs(db, sku) {
  const product = db.products.get(sku);
  if (!product) throw new Error(`unknown sku ${sku}`);
  const names = product.categoryPath.split(SEP);
  return names.map((name, i) => ({ name, path: names.slice(0, i + 1).join(SEP) }));
}
