export const PURCHASES_PER_FREE_DRINK = 10;

/**
 * The free-drink stamp card shown in the app: a free drink every 10 purchases.
 * @param {ReturnType<import('./store.js').createLoyaltyStore>} store
 * @param {string} customerId
 */
export function freeDrinkStatus(store, customerId) {
  const purchases = store.purchasesFor(customerId).length;
  return {
    purchases,
    freeDrinksEarned: Math.floor(purchases / PURCHASES_PER_FREE_DRINK),
    purchasesToNext: PURCHASES_PER_FREE_DRINK - (purchases % PURCHASES_PER_FREE_DRINK),
  };
}
