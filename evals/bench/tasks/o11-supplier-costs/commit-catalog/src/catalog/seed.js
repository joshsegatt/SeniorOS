import { createCatalog } from './catalog.js';

const CATEGORIES = ['mugs', 'teapots', 'plates', 'bowls', 'glasses', 'cutlery', 'linen', 'storage'];

/**
 * Local dev data shaped like the production catalog (about 40k SKUs today).
 * @param {number} [count]
 */
export function demoProducts(count = 40_000) {
  return Array.from({ length: count }, (_, i) => {
    const category = CATEGORIES[i % CATEGORIES.length];
    return {
      sku: `${category.slice(0, 3).toUpperCase()}-${String(i + 1).padStart(5, '0')}`,
      name: `${category} item ${i + 1}`,
      category,
      priceCents: 500 + ((i * 37) % 4500),
      costCents: null,
    };
  });
}

export function demoCatalog() {
  return createCatalog(demoProducts());
}
