import { keys } from '../cache/keys.js';
import { COUPONS } from './coupons.js';
import { computeSummary } from './summary.js';

// The summary is read on every page (basket badge), so it is cached; every change to a basket drops its entry.
const SUMMARY_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * @param {{ baskets: ReturnType<import('./store.js').createBasketStore>, kv: import('../cache/kv.js').Kv }} deps
 */
export function createBasketService({ baskets, kv }) {
  const forget = (basketId) => kv.delete(keys.basketSummary(basketId));

  return {
    /** @param {string} basketId @returns {Promise<import('./summary.js').BasketSummary>} */
    async getSummary(basketId) {
      const key = keys.basketSummary(basketId);
      const cached = await kv.get(key);
      if (cached) return cached;
      const summary = computeSummary(await baskets.get(basketId));
      await kv.set(key, summary, { ttlMs: SUMMARY_TTL_MS });
      return summary;
    },

    /** @param {string} basketId @param {import('./summary.js').BasketItem} item */
    async addItem(basketId, item) {
      const basket = await baskets.get(basketId);
      const existing = basket.items.find((i) => i.sku === item.sku);
      if (existing) existing.qty += item.qty;
      else basket.items.push({ ...item });
      await baskets.save(basket);
      await forget(basketId);
    },

    /** @param {string} basketId @param {string} code */
    async applyCoupon(basketId, code) {
      if (!(code in COUPONS)) throw new Error(`unknown coupon: ${code}`);
      const basket = await baskets.get(basketId);
      basket.coupon = code;
      await baskets.save(basket);
      await forget(basketId);
    },
  };
}
