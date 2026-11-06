/**
 * The products in a list of order items, with their quantity. Unknown skus are an error: a parcel must never be
 * quoted or labelled without the weight of everything in it.
 * @param {ReturnType<import('../catalog/store.js').createCatalog>} catalog
 * @param {{ sku: string, qty: number }[]} items
 */
export function itemsWithProducts(catalog, items) {
  return items.map((item) => {
    const product = catalog.get(item.sku);
    if (!product) throw new Error(`unknown sku: ${item.sku}`);
    if (!Number.isInteger(item.qty) || item.qty <= 0) throw new Error(`invalid quantity for ${item.sku}`);
    return { product, qty: item.qty };
  });
}
