import { canonicalSku } from './sku.js';

// Product catalog. Products are immutable; updates replace the object.
// `product.sku` keeps the spelling the supplier sent (used for display and links).

export function createCatalog() {
  const byKey = new Map();

  return {
    upsert({ sku, name, netCents, vatPermille }) {
      if (!Number.isInteger(netCents) || netCents < 0) throw new TypeError(`${sku}: netCents must be a non-negative integer`);
      if (!Number.isInteger(vatPermille) || vatPermille < 0) throw new TypeError(`${sku}: vatPermille must be a non-negative integer`);
      const key = canonicalSku(sku);
      const existing = byKey.get(key);
      const product = Object.freeze({ sku: existing?.sku ?? sku.trim(), name, netCents, vatPermille });
      byKey.set(key, product);
      return product;
    },

    get(sku) {
      return byKey.get(canonicalSku(sku)) ?? null;
    },

    setPrice(sku, netCents) {
      if (!Number.isInteger(netCents) || netCents < 0) throw new TypeError('netCents must be a non-negative integer');
      const key = canonicalSku(sku);
      const current = byKey.get(key);
      if (!current) throw new Error(`unknown sku ${sku}`);
      const next = Object.freeze({ ...current, netCents });
      byKey.set(key, next);
      return next;
    },

    all() {
      return [...byKey.values()];
    },
  };
}
