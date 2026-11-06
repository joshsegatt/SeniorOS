import { memoryBackend } from './backend.js';

/**
 * @typedef {{ at: string, kind: 'issue' | 'redeem' | 'credit', amountCents: number, ref: string }} CardEntry
 * @typedef {{ code: string, balanceCents: number, currency: 'EUR', status: 'active' | 'blocked', history: CardEntry[] }} GiftCard
 */

/** Gift card records over a backend. Every method is async. */
export function createGiftCardStore(backend = memoryBackend()) {
  /** Per-card queue: changes to one card run one at a time, from the read to the write. @type {Map<string, Promise<unknown>>} */
  const queues = new Map();

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
    /**
     * Read-modify-write one card atomically: `change` gets the current card (or null) and returns the new card, or
     * throws to leave it untouched. Every balance change goes through here.
     * @template T
     * @param {string} code
     * @param {(card: GiftCard | null) => { card: GiftCard, result: T }} change
     * @returns {Promise<T>}
     */
    update(code, change) {
      const previous = queues.get(code) ?? Promise.resolve();
      const run = previous.then(async () => {
        const { card, result } = change(await backend.read(code));
        await backend.write(code, card);
        return result;
      });
      const settled = run.catch(() => {});
      queues.set(code, settled);
      settled.then(() => {
        if (queues.get(code) === settled) queues.delete(code);
      });
      return run;
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
