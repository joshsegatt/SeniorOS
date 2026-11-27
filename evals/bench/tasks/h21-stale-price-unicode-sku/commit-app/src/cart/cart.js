import { canonicalSku } from '../catalog/sku.js';

// Shopping cart. Lines are merged per SKU; the first spelling seen is kept.

export function createCart() {
  const lines = new Map();
  return {
    add(sku, qty = 1) {
      if (!Number.isInteger(qty) || qty < 1) throw new RangeError('qty must be a positive integer');
      const key = canonicalSku(sku);
      const line = lines.get(key);
      if (line) line.qty += qty;
      else lines.set(key, { sku, qty });
    },
    lines() {
      return [...lines.values()].map((l) => ({ ...l }));
    },
  };
}

export function cartTotal(app, cart) {
  let total = 0;
  for (const line of cart.lines()) {
    const product = app.catalog.get(line.sku);
    if (!product) throw new Error(`product ${line.sku} no longer exists`);
    total += app.prices.priceFor(line.sku, product) * line.qty;
  }
  return total;
}
