import { itemsWithProducts } from './parcel.js';

// Carrier price list: the parcel goes in the first band its weight fits in.
const BANDS = [
  { upToKg: 2, label: 'up to 2 kg', cents: 490 },
  { upToKg: 5, label: 'up to 5 kg', cents: 690 },
  { upToKg: 10, label: 'up to 10 kg', cents: 990 },
  { upToKg: 20, label: 'up to 20 kg', cents: 1490 },
];
const ZONE_FACTOR = { domestic: 1, eu: 2, world: 3 };

/**
 * Shipping price shown at checkout.
 * @param {ReturnType<import('../catalog/store.js').createCatalog>} catalog
 * @param {{ sku: string, qty: number }[]} items
 * @param {'domestic' | 'eu' | 'world'} zone
 */
export function quoteShipping(catalog, items, zone) {
  const factor = ZONE_FACTOR[zone];
  if (!factor) throw new Error(`unknown zone: ${zone}`);
  // Records saved before weightGrams still have weightKg.
  const grams = itemsWithProducts(catalog, items).reduce((sum, { product, qty }) => sum + (product.weightGrams ?? Math.round(product.weightKg * 1000)) * qty, 0);
  const band = BANDS.find((b) => grams <= b.upToKg * 1000);
  if (!band) throw new Error('too heavy for one parcel');
  return { band: band.label, priceCents: band.cents * factor };
}
