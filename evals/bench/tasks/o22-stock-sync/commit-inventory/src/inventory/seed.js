/**
 * Local dev data shaped like the production catalog (about 42k products today).
 * @param {number} [count]
 * @returns {import('./catalog.js').Product[]}
 */
export function demoProducts(count = 42_000) {
  const kinds = ['Hoodie', 'T-shirt', 'Cap', 'Mug', 'Poster', 'Tote bag', 'Sticker', 'Notebook'];
  const colours = ['black', 'white', 'navy', 'olive', 'sand', 'red'];
  return Array.from({ length: count }, (_, i) => ({
    sku: `SKU-${String(i + 1).padStart(6, '0')}`,
    title: `${kinds[i % kinds.length]}, ${colours[(i * 5) % colours.length]} #${i + 1}`,
    price: 4.9 + (i % 40) * 1.25,
    stock: (i * 37) % 120,
    warehouse: i % 3 === 0 ? 'LEJ' : 'HAM',
  }));
}

/** @param {number} [count] */
export function demoCatalogJson(count) {
  return JSON.stringify(demoProducts(count));
}
