/** 1 point per whole dollar. @param {number} totalCents */
export function pointsFor(totalCents) {
  return Math.floor(totalCents / 100);
}

/**
 * The member's points balance, shown in the app and on the receipt.
 * @param {ReturnType<import('./store.js').createLoyaltyStore>} store
 * @param {string} customerId
 */
export function pointsBalance(store, customerId) {
  return store.purchasesFor(customerId).reduce((sum, p) => sum + pointsFor(p.totalCents), 0);
}
