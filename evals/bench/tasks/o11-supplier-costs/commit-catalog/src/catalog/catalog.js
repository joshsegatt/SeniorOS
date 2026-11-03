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
  let stats = computeStats(products);

  /** @param {string} sku @returns {Product | null} */
  function findBySku(sku) {
    const key = normalizeSku(sku);
    const found = products.find((p) => p.sku === key);
    return found ? { ...found } : null;
  }

  /** @param {string} sku @param {Partial<Omit<Product, 'sku'>>} patch @returns {Product} */
  function update(sku, patch) {
    const key = normalizeSku(sku);
    const found = products.find((p) => p.sku === key);
    if (!found) throw new Error(`unknown product ${sku}`);
    Object.assign(found, patch);
    stats = computeStats(products);
    return { ...found };
  }

  return {
    findBySku,
    update,
    /** @param {string} category */
    categoryStats: (category) => {
      const s = stats.get(category);
      return s ? { ...s } : null;
    },
    all: () => products.map((p) => ({ ...p })),
    get size() {
      return products.length;
    },
  };
}
