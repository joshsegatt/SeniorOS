import { memoryBackend } from './backend.js';

/**
 * @typedef {{ at: string, kind: 'issue' | 'redeem' | 'credit', amountCents: number, ref: string }} CardEntry
 * @typedef {{ code: string, balanceCents: number, currency: 'EUR', status: 'active' | 'blocked', history: CardEntry[] }} GiftCard
 */

/** Gift card records over a backend. Every method is async. */
export function createGiftCardStore(backend = memoryBackend()) {
  return {
    /** @param {string} code @returns {Promise<GiftCard | null>} */
    async get(code) {
      return backend.read(code);
    },
    /** @param {GiftCard} card */
    async put(card) {
      await backend.write(card.code, card);
      return card;
    },
    /** @returns {Promise<GiftCard[]>} */
    async list() {
      const keys = await backend.keys();
      const cards = [];
      for (const key of keys) cards.push(await backend.read(key));
      return cards;
    },
  };
}
