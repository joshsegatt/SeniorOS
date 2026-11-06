/** @typedef {{ sku: string, name: string, priceCents: number, active: boolean }} Product */

/** @returns {Map<string, Product>} */
export function defaultCatalog() {
  return new Map(
    [
      { sku: 'TEA-SENCHA-100', name: 'Sencha, 100 g', priceCents: 1290, active: true },
      { sku: 'TEA-ASSAM-250', name: 'Assam, 250 g', priceCents: 1890, active: true },
      { sku: 'MUG-STONE', name: 'Stoneware mug', priceCents: 2400, active: true },
      { sku: 'KETTLE-GOOSE', name: 'Gooseneck kettle', priceCents: 3660, active: true },
      { sku: 'TEA-EARLGREY-100', name: 'Earl Grey, 100 g', priceCents: 990, active: false },
    ].map((p) => [p.sku, p]),
  );
}

/**
 * Price a basket sent by the app. Throws on unknown or inactive products and bad quantities.
 * @param {Map<string, Product>} catalog
 * @param {{ sku: string, qty: number }[]} items
 */
export function priceItems(catalog, items) {
  if (!Array.isArray(items) || items.length === 0) throw new Error('the basket is empty');
  const lines = items.map(({ sku, qty }) => {
    const product = catalog.get(sku);
    if (!product || !product.active) throw new Error(`unknown product ${sku}`);
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) throw new Error(`bad quantity for ${sku}`);
    return { sku, name: product.name, qty, unitCents: product.priceCents, totalCents: product.priceCents * qty };
  });
  return { lines, totalCents: lines.reduce((sum, l) => sum + l.totalCents, 0) };
}
