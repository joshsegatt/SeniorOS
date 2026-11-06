import { itemsWithProducts } from './parcel.js';

// Carrier price list: the parcel goes in the first band its weight fits in.
const BANDS = [
  { upToGrams: 2000, label: 'up to 2 kg', cents: 490 },
  { upToGrams: 5000, label: 'up to 5 kg', cents: 690 },
  { upToGrams: 10000, label: 'up to 10 kg', cents: 990 },
  { upToGrams: 20000, label: 'up to 20 kg', cents: 1490 },
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
  const grams = itemsWithProducts(catalog, items).reduce((sum, { product, qty }) => sum + product.weightGrams * qty, 0);
  const band = BANDS.find((b) => grams <= b.upToGrams);
  if (!band) throw new Error('too heavy for one parcel');
  return { band: band.label, priceCents: band.cents * factor };
}
