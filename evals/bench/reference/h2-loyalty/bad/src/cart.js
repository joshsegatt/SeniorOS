/**
 * @typedef {{ sku: string, priceCents: number, qty: number }} CartItem
 * @typedef {{ code: string, percent: number }} Coupon
 */

/**
 * Total in cents after an optional percentage coupon and an optional loyalty discount.
 * @param {CartItem[]} items
 * @param {Coupon} [coupon]
 * @param {{ loyalty?: boolean }} [options]
 */
export function cartTotal(items, coupon, options = {}) {
  const subtotal = items.reduce((sum, item) => sum + item.priceCents * item.qty, 0);
  const afterCoupon = coupon ? subtotal - Math.round((subtotal * coupon.percent) / 100) : subtotal;
  return options.loyalty ? Math.round(afterCoupon * 0.85) : afterCoupon;
}

/** @param {CartItem[]} items */
export function itemCount(items) {
  return items.reduce((n, item) => n + item.qty, 0);
}
