import { creditGiftCard } from '../giftcards/credit.js';

/**
 * Cancel an order and put the gift card part back on the card.
 * @param {{ cards: ReturnType<import('../giftcards/store.js').createGiftCardStore>, orders: ReturnType<import('./store.js').createOrderStore> }} stores
 * @param {string} orderId
 * @param {() => Date} [now]
 */
export async function cancelOrder(stores, orderId, now = () => new Date()) {
  const order = await stores.orders.get(orderId);
  if (!order) throw new Error(`unknown order ${orderId}`);
  if (order.status === 'cancelled') return order;
  const cancelled = await stores.orders.save({ ...order, status: 'cancelled' });
  if (order.giftCard && order.giftCardCents > 0) {
    await creditGiftCard(stores.cards, { code: order.giftCard, amountCents: order.giftCardCents, ref: order.id }, now);
  }
  return cancelled;
}
