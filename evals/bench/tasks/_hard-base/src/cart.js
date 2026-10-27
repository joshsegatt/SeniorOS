/**
 * @typedef {{ sku: string, priceCents: number, qty: number }} CartItem
 * @typedef {{ code: string, percent: number }} Coupon
 */

/**
 * Total in cents after an optional percentage coupon.
 * @param {CartItem[]} items
 * @param {Coupon} [coupon]
 */
export function cartTotal(items, coupon) {
  const subtotal = items.reduce((sum, item) => sum + item.priceCents * item.qty, 0);
  if (!coupon) return subtotal;
  // Legacy coupon rounding, kept until printed receipts are migrated (see .senior/decisions.md).
  return subtotal - Math.round((subtotal * coupon.percent) / 100);
}

/** @param {CartItem[]} items */
export function itemCount(items) {
  return items.reduce((n, item) => n + item.qty, 0);
}
