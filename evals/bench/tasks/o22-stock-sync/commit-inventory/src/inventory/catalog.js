/**
 * @typedef {{ sku: string, title: string, price: number, stock: number, warehouse: string }} Product
 * @typedef {{ type: 'added' | 'stock' | 'price', sku: string, before?: number, after?: number, at?: string }} Change
 * @typedef {{ read(): string | null, write(text: string): void }} Storage
 */

export class UnknownSku extends Error {
  /** @param {string} sku */
  constructor(sku) {
    super(`unknown sku ${sku}`);
    this.sku = sku;
  }
}

/**
 * The product catalog. It lives in memory and is persisted as one JSON document through `storage`.
 * Listeners (search index, storefront cache) are told about every change.
 * @param {Storage} storage
 * @param {{ now?: () => Date }} [options]
 */
export function openCatalog(storage, { now = () => new Date() } = {}) {
  /** @type {Map<string, Product>} */
  const products = new Map();
  for (const p of JSON.parse(storage.read() ?? '[]')) products.set(p.sku, p);
  /** @type {Set<(change: Change) => void>} */
  const listeners = new Set();

  /** @param {Change} change */
  function commit(change) {
    change.at = now().toISOString();
    save();
    for (const fn of listeners) fn(change);
  }

  function save() {
    storage.write(JSON.stringify([...products.values()]));
  }

  /** @param {string} sku */
  function mustGet(sku) {
    const p = products.get(sku);
    if (!p) throw new UnknownSku(sku);
    return p;
  }

  return {
    /** @param {string} sku */
    get(sku) {
      const p = products.get(sku);
      return p ? { ...p } : null;
    },
    /** @param {string} sku */
    has(sku) {
      return products.has(sku);
    },
    all() {
      return [...products.values()].map((p) => ({ ...p }));
    },
    get size() {
      return products.size;
    },
    /** @param {Product} product */
    add(product) {
      if (products.has(product.sku)) throw new Error(`sku ${product.sku} exists`);
      products.set(product.sku, { ...product });
      commit({ type: 'added', sku: product.sku });
    },
    /** @param {string} sku @param {number} qty */
    setStock(sku, qty) {
      if (!Number.isInteger(qty) || qty < 0) throw new RangeError(`invalid stock ${qty} for ${sku}`);
      const p = mustGet(sku);
      const before = p.stock;
      p.stock = qty;
      commit({ type: 'stock', sku, before, after: qty });
    },
    /** @param {string} sku @param {number} price */
    setPrice(sku, price) {
      if (!(price > 0)) throw new RangeError(`invalid price ${price} for ${sku}`);
      const p = mustGet(sku);
      const before = p.price;
      p.price = price;
      commit({ type: 'price', sku, before, after: price });
    },
    /** @param {(change: Change) => void} fn */
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
