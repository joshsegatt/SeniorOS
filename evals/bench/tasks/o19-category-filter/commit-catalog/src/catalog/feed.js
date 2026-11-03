/**
 * Rows of the product feed we upload to Google Merchant Center every night.
 * @param {ReturnType<import('./db.js').createCatalogDb>} db
 */
export function merchantFeed(db) {
  return [...db.products.values()]
    .filter((p) => p.active)
    .sort((a, b) => a.sku.localeCompare(b.sku))
    .map((p) => ({ id: p.sku, title: p.title, price: `${p.price.toFixed(2)} EUR`, product_type: p.categoryPath }));
}
