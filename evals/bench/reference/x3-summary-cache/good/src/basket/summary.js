import { couponDiscountCents } from './coupons.js';

/**
 * @typedef {{ sku: string, name: string, priceCents: number, qty: number }} BasketItem
 * @typedef {{ id: string, items: BasketItem[], coupon: string | null }} Basket
 * @typedef {{ itemCount: number, subtotalCents: number, discountCents: number, totalCents: number }} BasketSummary
 */

/**
 * What the basket badge and the checkout page show.
 * @param {Basket} basket
 * @returns {BasketSummary}
 */
export function computeSummary(basket) {
  const itemCount = basket.items.reduce((n, item) => n + item.qty, 0);
  const subtotalCents = basket.items.reduce((sum, item) => sum + item.priceCents * item.qty, 0);
  const discountCents = couponDiscountCents(basket.coupon, subtotalCents);
  const totalCents = subtotalCents - discountCents;
  return { itemCount, subtotalCents, discountCents, totalCents };
}
