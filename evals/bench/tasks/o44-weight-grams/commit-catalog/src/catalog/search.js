/**
 * Case-insensitive search over sku and title; every word must match. Inactive products are left out.
 * @param {ReturnType<import('./store.js').createCatalog>} catalog
 * @param {string} query
 */
export function searchProducts(catalog, query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return catalog
    .all()
    .filter((p) => p.active)
    .filter((p) => words.every((w) => p.sku.toLowerCase().includes(w) || p.title.toLowerCase().includes(w)))
    .map((p) => p.sku)
    .sort();
}
