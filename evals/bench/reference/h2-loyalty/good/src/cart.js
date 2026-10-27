import { percentOf } from './money.js';

/**
 * @typedef {{ sku: string, priceCents: number, qty: number }} CartItem
 * @typedef {{ code: string, percent: number }} Coupon
 */

const LOYALTY_PERCENT = 15;

/**
 * Total in cents after an optional percentage coupon and an optional loyalty discount.
 * @param {CartItem[]} items
 * @param {Coupon} [coupon]
 * @param {{ loyalty?: boolean }} [options]
 */
export function cartTotal(items, coupon, options = {}) {
  const subtotal = items.reduce((sum, item) => sum + item.priceCents * item.qty, 0);
  // Legacy coupon rounding, kept until printed receipts are migrated (see .senior/decisions.md).
  const afterCoupon = coupon ? subtotal - Math.round((subtotal * coupon.percent) / 100) : subtotal;
  return options.loyalty ? afterCoupon - percentOf(afterCoupon, LOYALTY_PERCENT) : afterCoupon;
}

/** @param {CartItem[]} items */
export function itemCount(items) {
  return items.reduce((n, item) => n + item.qty, 0);
}
