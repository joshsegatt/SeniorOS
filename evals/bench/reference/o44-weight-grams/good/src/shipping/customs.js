import { itemsWithProducts } from './parcel.js';

/**
 * Customs declaration (CN23) for parcels leaving the EU: one line per product, net mass in kilograms rounded to
 * the gram, value in cents.
 * @param {ReturnType<import('../catalog/store.js').createCatalog>} catalog
 * @param {{ sku: string, qty: number }[]} items
 */
export function customsDeclaration(catalog, items) {
  const lines = itemsWithProducts(catalog, items).map(({ product, qty }) => ({
    sku: product.sku,
    description: product.title,
    hsCode: product.hsCode ?? null,
    origin: product.originCountry ?? null,
    quantity: qty,
    netMassKg: (product.weightGrams * qty) / 1000,
    valueCents: product.priceCents * qty,
  }));
  return {
    lines,
    totalNetMassKg: lines.reduce((sum, l) => sum + Math.round(l.netMassKg * 1000), 0) / 1000,
    totalValueCents: lines.reduce((sum, l) => sum + l.valueCents, 0),
  };
}
