/**
 * JSON for the mobile app (it renders names as plain text).
 * @param {ReturnType<import('../catalog/store.js').createCatalog>} catalog
 * @param {string} sku
 */
export function getProductJson(catalog, sku) {
  const p = catalog.get(String(sku).toUpperCase());
  if (!p) return { status: 404, body: { error: 'not found' } };
  return { status: 200, body: { sku: p.sku, name: p.name, price: { amount: p.priceCents, currency: 'EUR' } } };
}
