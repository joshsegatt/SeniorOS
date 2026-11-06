import { itemsWithProducts } from './parcel.js';

/**
 * The label data sent to the carrier when a parcel is packed. The carrier wants the gross weight in kilograms
 * with three decimals ("2.520 kg").
 * @param {ReturnType<import('../catalog/store.js').createCatalog>} catalog
 * @param {{ id: string, to: string, items: { sku: string, qty: number }[] }} parcel
 */
export function labelFor(catalog, parcel) {
  const lines = itemsWithProducts(catalog, parcel.items);
  const kg = lines.reduce((sum, { product, qty }) => sum + product.weightKg * qty, 0);
  return {
    parcelId: parcel.id,
    to: parcel.to,
    weight: `${kg.toFixed(3)} kg`,
    contents: lines.map(({ product, qty }) => `${qty} x ${product.title}`).join(', '),
  };
}
