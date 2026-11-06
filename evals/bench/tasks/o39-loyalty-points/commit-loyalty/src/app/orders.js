/**
 * An order placed in the mobile app for pickup; the member is signed in.
 * @param {ReturnType<import('../loyalty/store.js').createLoyaltyStore>} store
 * @param {{ customerId: string, storeId: string, totalCents: number }} input
 * @param {() => Date} [now]
 */
export function placeAppOrder(store, input, now = () => new Date()) {
  if (!store.getMember(input.customerId)) throw new Error(`unknown member ${input.customerId}`);
  if (!Number.isInteger(input.totalCents) || input.totalCents <= 0) throw new Error('invalid total');
  const id = store.nextId('p');
  return store.insertPurchase({
    id,
    receipt: `APP-${id.slice(2)}`,
    customerId: input.customerId,
    storeId: input.storeId,
    totalCents: input.totalCents,
    purchasedAt: now().toISOString(),
    channel: 'app',
  });
}
