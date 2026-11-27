// In-memory catalog. Physical items carry weightGrams; digital items carry digital: true.
export const DEMO_ITEMS = Object.freeze([
  { sku: 'BOOK-1', name: 'Field guide', priceCents: 2900, weightGrams: 600 },
  { sku: 'LAMP-2', name: 'Desk lamp', priceCents: 8900, weightGrams: 2400 },
  { sku: 'BENCH-3', name: 'Garden bench', priceCents: 24900, weightGrams: 18000 },
  { sku: 'GIFT-50', name: 'Gift card CHF 50', priceCents: 5000, digital: true },
  { sku: 'EBOOK-7', name: 'Field guide (e-book)', priceCents: 1500, digital: true },
]);

export function createCatalog(items = DEMO_ITEMS) {
  const bySku = new Map(items.map((item) => [item.sku, Object.freeze({ ...item })]));
  return {
    get(sku) {
      return bySku.get(sku) ?? null;
    },
  };
}
