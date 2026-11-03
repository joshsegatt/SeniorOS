import { SEP } from './categories.js';

/**
 * The shop's category page: active products in the category and all its subcategories, by title.
 * @param {ReturnType<import('./db.js').createCatalogDb>} db
 * @param {string} path e.g. "Outdoor > Grills"
 */
export function productsInCategory(db, path) {
  const prefix = path + SEP;
  return [...db.products.values()]
    .filter((p) => p.active && (p.categoryPath === path || p.categoryPath.startsWith(prefix)))
    .map((p) => ({ ...p }))
    .sort((a, b) => a.title.localeCompare(b.title));
}
