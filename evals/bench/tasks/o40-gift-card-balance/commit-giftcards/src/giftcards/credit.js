import { normalizeCode } from './cards.js';

/** @typedef {ReturnType<import('./store.js').createGiftCardStore>} GiftCardStore */

/**
 * Put money back on a card (refund of an order paid by gift card). Blocked cards are credited too: the money is the
 * customer's either way.
 * @param {GiftCardStore} store
 * @param {{ code: string, amountCents: number, ref: string }} input
 * @param {() => Date} [now]
 */
export async function creditGiftCard(store, input, now = () => new Date()) {
  const code = normalizeCode(input.code);
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new Error('amountCents must be a positive integer');
  const card = await store.get(code);
  if (!card) throw new Error(`unknown gift card ${code}`);
  const balanceCents = card.balanceCents + input.amountCents;
  await store.put({
    ...card,
    balanceCents,
    history: [...card.history, { at: now().toISOString(), kind: 'credit', amountCents: input.amountCents, ref: input.ref }],
  });
  return { code, creditedCents: input.amountCents, balanceCents };
}
