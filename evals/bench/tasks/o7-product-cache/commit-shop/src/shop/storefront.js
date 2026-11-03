/** @param {number} cents */
function chf(cents) {
  return `CHF ${(cents / 100).toFixed(2)}`;
}

/** @param {{ catalog: ReturnType<import('./catalog.js').createCatalog> }} deps */
export function createStorefront({ catalog }) {
  return {
    /** @param {string} id */
    productPage(id) {
      const p = catalog.getProduct(id);
      if (!p) return { status: 404, body: { error: 'not found' } };
      return {
        status: 200,
        body: { id: p.id, title: p.name, price: chf(p.priceCents), inStock: p.stock > 0, stockLeft: p.stock, badge: p.isNew ? 'new' : null },
      };
    },
    listing() {
      return { status: 200, body: catalog.listProducts().map((p) => ({ id: p.id, title: p.name, price: chf(p.priceCents) })) };
    },
  };
}
