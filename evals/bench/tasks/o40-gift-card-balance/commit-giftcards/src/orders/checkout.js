import { redeemGiftCard } from '../giftcards/redeem.js';

/**
 * Place an order paid in full with a gift card. Card payments for a remainder go through the old checkout.
 * @param {{ cards: ReturnType<import('../giftcards/store.js').createGiftCardStore>, orders: ReturnType<import('./store.js').createOrderStore> }} stores
 * @param {{ customerId: string, totalCents: number, giftCard: string }} input
 * @param {() => Date} [now]
 */
export async function placeOrder(stores, input, now = () => new Date()) {
  const id = stores.orders.nextId();
  const redemption = await redeemGiftCard(stores.cards, { code: input.giftCard, amountCents: input.totalCents, orderId: id }, now);
  return stores.orders.save({
    id,
    customerId: input.customerId,
    totalCents: input.totalCents,
    giftCard: redemption.code,
    giftCardCents: redemption.redeemedCents,
    status: 'paid',
  });
}
