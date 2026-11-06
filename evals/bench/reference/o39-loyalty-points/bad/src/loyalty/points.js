/** 1 point per whole dollar. @param {number} totalCents */
export function pointsFor(totalCents) {
  return Math.floor(totalCents / 100);
}

/**
 * The member's points balance, shown in the app and on the receipt.
 * Purchases uploaded by the register sync are saved under the card number, so look those up too.
 * @param {ReturnType<import('./store.js').createLoyaltyStore>} store
 * @param {string} customerId
 */
export function pointsBalance(store, customerId) {
  const member = store.getMember(customerId);
  const purchases = store.purchasesFor(customerId);
  if (member) purchases.push(...store.purchasesFor(member.cardNumber));
  return purchases.reduce((sum, p) => sum + pointsFor(p.totalCents), 0);
}
