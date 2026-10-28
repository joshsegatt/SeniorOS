/** Active coupon codes and their percentage off the subtotal. */
export const COUPONS = { TEN: 10, WELCOME5: 5, STAFF25: 25 };

/**
 * Discount in cents for a coupon code (0 for no code or an unknown code). Rounded down: never discount a
 * fraction of a cent more than the coupon promises.
 * @param {string | null | undefined} code
 * @param {number} subtotalCents
 */
export function couponDiscountCents(code, subtotalCents) {
  const percent = code ? COUPONS[code] ?? 0 : 0;
  return Math.floor((subtotalCents * percent) / 100);
}
