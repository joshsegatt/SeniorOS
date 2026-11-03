/**
 * In-memory catalog database (production uses the same shape over Postgres).
 * @typedef {{ id: string, name: string, parentId: string | null }} Category
 * @typedef {{ sku: string, title: string, price: number, categoryId: string, categoryPath: string, active: boolean }} Product
 */
export function createCatalogDb() {
  let seq = 0;
  return {
    /** @type {Map<string, Category>} */
    categories: new Map(),
    /** @type {Map<string, Product>} */
    products: new Map(),
    /** @param {string} prefix */
    nextId(prefix) {
      seq += 1;
      return `${prefix}${seq}`;
    },
  };
}

/** Loads a snapshot exported from production (data/catalog-snapshot.json). @param {{ categories: Category[], products: Product[] }} snapshot */
export function loadSnapshot(snapshot) {
  const db = createCatalogDb();
  for (const c of snapshot.categories) db.categories.set(c.id, { ...c });
  for (const p of snapshot.products) db.products.set(p.sku, { ...p });
  return db;
}
