// In-memory catalog, same API as the shop catalog service.
export class Catalog {
  #products = new Map();

  upsert(product) {
    this.#products.set(product.sku, structuredClone(product));
  }

  get(sku) {
    const product = this.#products.get(sku);
    return product && structuredClone(product);
  }

  get size() {
    return this.#products.size;
  }

  all() {
    return [...this.#products.values()].map((p) => structuredClone(p));
  }
}
