import { itemsWithProducts } from './parcel.js';

/**
 * The label data sent to the carrier when a parcel is packed. The carrier wants the gross weight in kilograms
 * with three decimals ("2.520 kg").
 * @param {ReturnType<import('../catalog/store.js').createCatalog>} catalog
 * @param {{ id: string, to: string, items: { sku: string, qty: number }[] }} parcel
 */
export function labelFor(catalog, parcel) {
  const lines = itemsWithProducts(catalog, parcel.items);
  const grams = lines.reduce((sum, { product, qty }) => sum + product.weightGrams * qty, 0);
  return {
    parcelId: parcel.id,
    to: parcel.to,
    weight: `${(grams / 1000).toFixed(3)} kg`,
    contents: lines.map(({ product, qty }) => `${qty} x ${product.title}`).join(', '),
  };
}
