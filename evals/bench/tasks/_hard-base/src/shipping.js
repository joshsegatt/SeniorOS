/** Orders at or above this subtotal ship for free, in cents. */
export const FREE_SHIPPING_THRESHOLD = 5000;
export const STANDARD_SHIPPING = 790;

/** @param {number} subtotalCents */
export function shippingCost(subtotalCents) {
  return subtotalCents >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING;
}
