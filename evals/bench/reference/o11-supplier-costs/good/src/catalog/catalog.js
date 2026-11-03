/**
 * Product catalog with the per-category margin figures shown on the purchasing dashboard.
 * @typedef {{ sku: string, name: string, category: string, priceCents: number, costCents: number | null }} Product
 * @typedef {{ products: number, withCost: number, avgMarginPct: number | null }} CategoryStats
 */

/** SKUs are compared trimmed and upper-case. @param {string} sku */
export function normalizeSku(sku) {
  return String(sku).trim().toUpperCase();
}

/** @param {Product[]} products @returns {Map<string, CategoryStats>} */
function computeStats(products) {
  /** @type {Map<string, { products: number, withCost: number, marginSum: number }>} */
  const acc = new Map();
  for (const p of products) {
    let a = acc.get(p.category);
    if (!a) acc.set(p.category, (a = { products: 0, withCost: 0, marginSum: 0 }));
    a.products += 1;
    if (p.costCents !== null && p.priceCents > 0) {
      a.withCost += 1;
      a.marginSum += ((p.priceCents - p.costCents) / p.priceCents) * 100;
    }
  }
  const stats = new Map();
  for (const [category, a] of acc) {
    stats.set(category, { products: a.products, withCost: a.withCost, avgMarginPct: a.withCost ? Math.round((a.marginSum / a.withCost) * 10) / 10 : null });
  }
  return stats;
}

/** @param {Product[]} rows products from the catalog snapshot */
export function createCatalog(rows = []) {
  /** @type {Product[]} */
  const products = rows.map((p) => ({ ...p, sku: normalizeSku(p.sku), costCents: p.costCents ?? null }));
  // The catalog has ~40k SKUs and imports touch all of them: index by SKU, recompute stats only when read.
  /** @type {Map<string, Product>} */
  const bySku = new Map(products.map((p) => [p.sku, p]));
  /** @type {Map<string, CategoryStats> | null} */
  let stats = null;

  /** @param {string} sku @returns {Product | null} */
  function findBySku(sku) {
    const found = bySku.get(normalizeSku(sku));
    return found ? { ...found } : null;
  }

  /** @param {string} sku @param {Partial<Omit<Product, 'sku'>>} patch @returns {Product} */
  function update(sku, patch) {
    const found = bySku.get(normalizeSku(sku));
    if (!found) throw new Error(`unknown product ${sku}`);
    Object.assign(found, patch);
    stats = null;
    return { ...found };
  }

  return {
    findBySku,
    update,
    /** @param {string} category */
    categoryStats: (category) => {
      stats ??= computeStats(products);
      const s = stats.get(category);
      return s ? { ...s } : null;
    },
    all: () => products.map((p) => ({ ...p })),
    get size() {
      return products.length;
    },
  };
}
