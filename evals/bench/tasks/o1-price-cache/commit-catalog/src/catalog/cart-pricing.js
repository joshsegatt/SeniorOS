/**
 * Prices a cart against the live catalog.
 * @param {ReturnType<typeof import('./catalog.js').createCatalog>} catalog
 * @param {{ productId: string, qty: number }[]} items
 */
export async function priceCart(catalog, items) {
  const products = await Promise.all(items.map((item) => catalog.getProduct(item.productId)));
  const lines = items.map((item, i) => ({
    productId: item.productId,
    name: products[i].name,
    qty: item.qty,
    unitCents: products[i].priceCents,
    lineCents: products[i].priceCents * item.qty,
  }));
  return { lines, totalCents: lines.reduce((sum, l) => sum + l.lineCents, 0) };
}
