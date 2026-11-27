import { FulfillmentError } from './errors.js';

export const MAX_PARCEL_GRAMS = 30000;

/**
 * Splits the order into parcels of at most MAX_PARCEL_GRAMS for the warehouse.
 * @returns {Array<{ skus: string[], grams: number }>}
 */
export function planParcels(lines) {
  const parcels = [];
  let current = { skus: [], grams: 0 };

  for (const { item, qty } of lines) {
    // Digital items are delivered by email: no weight, never in a parcel (docs/checkout-flow.md).
    if (item.digital) continue;
    const grams = item.weightGrams;
    if (!Number.isInteger(grams) || grams <= 0) {
      throw new FulfillmentError(`no shipping weight for ${item.sku}`);
    }
    if (grams > MAX_PARCEL_GRAMS) throw new FulfillmentError(`${item.sku} is too heavy for a parcel`);
    for (let unit = 0; unit < qty; unit += 1) {
      if (current.grams + grams > MAX_PARCEL_GRAMS) {
        parcels.push(current);
        current = { skus: [], grams: 0 };
      }
      current.skus.push(item.sku);
      current.grams += grams;
    }
  }
  if (current.skus.length > 0) parcels.push(current);
  return parcels;
}
