/**
 * Catalog service used by the product pages, the cart and the admin price editor.
 * @typedef {import('./db.js').Product} Product
 */

export class ProductNotFound extends Error {
  /** @param {string} id */
  constructor(id) {
    super(`product not found: ${id}`);
    this.id = id;
  }
}

/** @param {{ db: ReturnType<typeof import('./db.js').createProductDb> }} deps */
export function createCatalog({ db }) {
  /** @type {Map<string, Product>} */
  const cache = new Map();

  return {
    /** @param {string} id @returns {Promise<Product>} */
    async getProduct(id) {
      const hit = cache.get(id);
      if (hit) return { ...hit };
      const product = await db.getProduct(id);
      if (!product) throw new ProductNotFound(id);
      cache.set(id, product);
      return { ...product };
    },

    /** Admin price editor. @param {string} id @param {number} priceCents */
    async updatePrice(id, priceCents) {
      if (!Number.isInteger(priceCents) || priceCents <= 0) throw new RangeError(`invalid price: ${priceCents}`);
      await db.setPrice(id, priceCents);
      cache.delete(id);
    },
  };
}
