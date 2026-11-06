import { normalizeCode } from './cards.js';

/** @typedef {ReturnType<import('./store.js').createGiftCardStore>} GiftCardStore */

/** Redemptions in progress per card: a second one waits for the first. @type {Map<string, Promise<unknown>>} */
const inProgress = new Map();

/**
 * Pay part or all of an order with a gift card. Refuses when the card does not hold enough: a card never goes below
 * zero.
 * @param {GiftCardStore} store
 * @param {{ code: string, amountCents: number, orderId: string }} input
 * @param {() => Date} [now]
 * @returns {Promise<{ code: string, redeemedCents: number, balanceCents: number }>}
 */
export async function redeemGiftCard(store, input, now = () => new Date()) {
  const code = normalizeCode(input.code);
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new Error('amountCents must be a positive integer');

  const previous = inProgress.get(code) ?? Promise.resolve();
  const run = previous.then(async () => {
    const card = await store.get(code);
    if (!card) throw new Error(`unknown gift card ${code}`);
    if (card.status !== 'active') throw new Error(`gift card ${code} is ${card.status}`);
    if (card.balanceCents < input.amountCents) throw new Error(`insufficient balance on ${code}`);

    const updated = {
      ...card,
      balanceCents: card.balanceCents - input.amountCents,
      history: [...card.history, { at: now().toISOString(), kind: /** @type {const} */ ('redeem'), amountCents: -input.amountCents, ref: input.orderId }],
    };
    await store.put(updated);
    return { code, redeemedCents: input.amountCents, balanceCents: updated.balanceCents };
  });
  inProgress.set(code, run.catch(() => {}));
  return run;
}
