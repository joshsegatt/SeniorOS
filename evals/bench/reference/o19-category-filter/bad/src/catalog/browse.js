import { categoryPath } from './categories.js';

/**
 * The shop's category page: active products in the category and all its subcategories, by title.
 * Matches on the category ids, so products whose stored path is stale (after a rename) still show.
 * @param {ReturnType<import('./db.js').createCatalogDb>} db
 * @param {string} path e.g. "Outdoor > Grills"
 */
export function productsInCategory(db, path) {
  const root = [...db.categories.values()].find((c) => categoryPath(db, c.id) === path);
  if (!root) return [];
  const ids = new Set([root.id]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const c of db.categories.values()) {
      if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) {
        ids.add(c.id);
        grew = true;
      }
    }
  }
  return [...db.products.values()]
    .filter((p) => p.active && ids.has(p.categoryId))
    .map((p) => ({ ...p }))
    .sort((a, b) => a.title.localeCompare(b.title));
}
