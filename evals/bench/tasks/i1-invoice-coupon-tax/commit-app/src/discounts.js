import { roundHalfUp } from './money.js';

/** Discount in cents for a coupon on a subtotal. Never exceeds the subtotal. */
export function discountFor(subtotalCents, coupon) {
  if (!coupon) return 0;
  if (coupon.type === 'percent') {
    if (!Number.isInteger(coupon.value) || coupon.value < 0 || coupon.value > 100) {
      throw new RangeError('percent coupon value must be an integer between 0 and 100');
    }
    return Math.min(subtotalCents, roundHalfUp(subtotalCents * coupon.value, 100));
  }
  if (coupon.type === 'fixed') {
    if (!Number.isInteger(coupon.cents) || coupon.cents < 0) {
      throw new RangeError('fixed coupon cents must be a non-negative integer');
    }
    return Math.min(subtotalCents, coupon.cents);
  }
  throw new TypeError(`unknown coupon type ${coupon.type}`);
}
