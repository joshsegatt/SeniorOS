/**
 * Products created by the team in the back office.
 * @param {ReturnType<import('./store.js').createCatalog>} catalog
 * @param {{ sku: string, name: string, priceCents: number }} input
 */
export function createProduct(catalog, input) {
  const sku = String(input.sku ?? '').trim().toUpperCase();
  const name = String(input.name ?? '').trim();
  if (!sku) throw new Error('sku is required');
  if (!name) throw new Error('name is required');
  if (!Number.isInteger(input.priceCents) || input.priceCents <= 0) throw new Error('invalid price');
  if (catalog.get(sku)) throw new Error(`product ${sku} already exists`);
  return catalog.upsert({ sku, name, priceCents: input.priceCents, source: 'admin' });
}
