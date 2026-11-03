/**
 * Storefront search: every word of the query must appear in the product name (case-insensitive).
 * @param {ReturnType<import('../catalog/store.js').createCatalog>} catalog
 * @param {string} query
 */
export function searchProducts(catalog, query) {
  const words = String(query ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return catalog
    .all()
    .filter((p) => {
      const name = p.name.toLowerCase();
      return words.every((w) => name.includes(w));
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
