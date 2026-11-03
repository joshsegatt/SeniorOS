/**
 * Checkout: prices and stock come from the catalog, the stock is taken from the database.
 * @param {{ db: ReturnType<import('./db.js').createDb>, catalog: ReturnType<import('./catalog.js').createCatalog> }} deps
 */
export function createOrders({ db, catalog }) {
  let seq = 0;
  return {
    /** @param {{ productId: string, qty: number }} input */
    placeOrder({ productId, qty }) {
      if (!Number.isInteger(qty) || qty < 1) return { ok: false, error: 'invalid quantity' };
      const product = catalog.getProduct(productId);
      if (!product) return { ok: false, error: 'unknown product' };
      if (product.stock < qty) return { ok: false, error: 'out of stock' };
      db.adjustStock(productId, -qty);
      catalog.invalidate(productId);
      seq += 1;
      return { ok: true, order: { id: `o-${seq}`, productId, qty, totalCents: product.priceCents * qty } };
    },
  };
}
