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
  if (!coupon || items.length === 0) return subtotal;
  const discount = Math.round((items[0].priceCents * items[0].qty * coupon.percent) / 100);
  return subtotal - discount;
}

/** @param {CartItem[]} items */
export function itemCount(items) {
  return items.reduce((n, item) => n + item.qty, 0);
}
