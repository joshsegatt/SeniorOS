/** @typedef {ReturnType<import('./store.js').createGiftCardStore>} GiftCardStore */

const CODE = /^GC-[A-Z0-9]{4}$/;

/** @param {string} code */
export function normalizeCode(code) {
  const c = String(code ?? '').trim().toUpperCase();
  if (!CODE.test(c)) throw new Error(`invalid gift card code ${code}`);
  return c;
}

/**
 * Issue a new card with an initial balance.
 * @param {GiftCardStore} store
 * @param {{ code: string, amountCents: number, ref: string }} input
 * @param {() => Date} [now]
 */
export async function issueGiftCard(store, input, now = () => new Date()) {
  const code = normalizeCode(input.code);
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new Error('amountCents must be a positive integer');
  return store.update(code, (existing) => {
    if (existing) throw new Error(`gift card ${code} already exists`);
    /** @type {import('./store.js').GiftCard} */
    const card = {
      code,
      balanceCents: input.amountCents,
      currency: 'EUR',
      status: 'active',
      history: [{ at: now().toISOString(), kind: 'issue', amountCents: input.amountCents, ref: input.ref }],
    };
    return { card, result: card };
  });
}

/** @param {GiftCardStore} store @param {string} code */
export async function getBalance(store, code) {
  const card = await store.get(normalizeCode(code));
  if (!card) throw new Error(`unknown gift card ${code}`);
  return card.balanceCents;
}

/** Block a lost or stolen card. @param {GiftCardStore} store @param {string} code */
export async function blockGiftCard(store, code) {
  const c = normalizeCode(code);
  return store.update(c, (card) => {
    if (!card) throw new Error(`unknown gift card ${code}`);
    const blocked = { ...card, status: /** @type {const} */ ('blocked') };
    return { card: blocked, result: blocked };
  });
}
