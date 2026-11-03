import { slugify } from '../lib/slug.js';

/** URL handle for a product name, e.g. "Crème Mug (Large)" -> "creme-mug-large". */
export const handleize = (name) => slugify(name, { maxLength: 60 });

export function createProducts() {
  const byHandle = new Map();
  const byId = new Map();
  let seq = 0;

  return {
    add({ name, priceCents }) {
      const base = handleize(name);
      if (!base) throw new RangeError(`no handle can be made from ${JSON.stringify(name)}`);
      let handle = base;
      for (let n = 1; byHandle.has(handle); n++) handle = `${base}-${n}`;
      const product = { id: `p${++seq}`, name, priceCents, handle, url: `/products/${handle}` };
      byHandle.set(handle, product);
      byId.set(product.id, product);
      return { ...product };
    },
    rename(id, name) {
      const product = byId.get(id);
      if (!product) throw new RangeError(`no product ${id}`);
      product.name = name;
      return { ...product };
    },
    byHandle(handle) {
      const product = byHandle.get(handle);
      return product ? { ...product } : null;
    },
  };
}
