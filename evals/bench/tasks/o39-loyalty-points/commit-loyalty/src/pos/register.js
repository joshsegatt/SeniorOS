/**
 * A purchase rung up on a connected register; the barista scans the member's card.
 * @param {ReturnType<import('../loyalty/store.js').createLoyaltyStore>} store
 * @param {{ receipt: string, cardNumber: string, storeId: string, totalCents: number }} input
 * @param {() => Date} [now]
 */
export function recordPurchase(store, input, now = () => new Date()) {
  const cardNumber = String(input.cardNumber ?? '').trim().toUpperCase();
  const member = store.findMemberByCard(cardNumber);
  if (!member) throw new Error(`unknown card ${cardNumber}`);
  if (!Number.isInteger(input.totalCents) || input.totalCents <= 0) throw new Error('invalid total');
  if (store.hasReceipt(input.receipt)) throw new Error(`receipt ${input.receipt} already recorded`);
  return store.insertPurchase({
    id: store.nextId('p'),
    receipt: input.receipt,
    customerId: member.id,
    storeId: input.storeId,
    totalCents: input.totalCents,
    purchasedAt: now().toISOString(),
    channel: 'register',
  });
}
