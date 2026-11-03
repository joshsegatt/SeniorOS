/**
 * Shipping methods offered at checkout.
 * @typedef {{ label: string, priceCents: number, carrier: string | null, freeFromThreshold: boolean }} ShippingMethod  carrier null: collected at the shop, no delivery address
 * @type {Record<string, ShippingMethod>}
 */
export const SHIPPING_METHODS = {
  standard: { label: 'Standard delivery (2-4 working days)', priceCents: 490, carrier: 'ctt', freeFromThreshold: true },
  express: { label: 'Express delivery (next working day)', priceCents: 990, carrier: 'dhl', freeFromThreshold: false },
  pickup: { label: 'Pickup at our shop', priceCents: 0, carrier: null, freeFromThreshold: false },
};

/** @param {string} id @returns {ShippingMethod | null} */
export function shippingMethod(id) {
  return Object.hasOwn(SHIPPING_METHODS, id) ? SHIPPING_METHODS[id] : null;
}
