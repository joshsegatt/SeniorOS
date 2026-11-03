/**
 * Keeps the storefront search index in step with the catalog: products that run out of stock are
 * hidden from search, and shown again when stock comes back.
 * @param {ReturnType<import('./catalog.js').openCatalog>} catalog
 * @param {{ setAvailable(sku: string, available: boolean): void }} index
 */
export function connectSearchIndex(catalog, index) {
  return catalog.onChange((change) => {
    if (change.type === 'stock' && (change.before === 0) !== (change.after === 0)) index.setAvailable(change.sku, Number(change.after) > 0);
    if (change.type === 'added') index.setAvailable(change.sku, Number(catalog.get(change.sku)?.stock) > 0);
  });
}
