/**
 * Uploads the purchases a register queued while the store was offline. Receipts already uploaded
 * and purchases without a loyalty card are skipped, so a register can send the same batch again.
 * @param {ReturnType<import('../loyalty/store.js').createLoyaltyStore>} store
 * @param {{ storeId: string, register: string, purchases: { receipt: string, customer: string | null, totalCents: number, at: string }[] }} batch
 */
export function syncRegisterBatch(store, batch) {
  const result = { added: 0, skipped: 0 };
  for (const p of batch.purchases) {
    if (!p.customer || store.hasReceipt(p.receipt)) {
      result.skipped += 1;
      continue;
    }
    store.insertPurchase({
      id: store.nextId('p'),
      receipt: p.receipt,
      customerId: String(p.customer).trim().toUpperCase(),
      storeId: batch.storeId,
      totalCents: p.totalCents,
      purchasedAt: new Date(p.at).toISOString(),
      channel: 'register',
    });
    result.added += 1;
  }
  return result;
}
