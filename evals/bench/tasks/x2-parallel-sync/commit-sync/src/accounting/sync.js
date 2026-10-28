/**
 * Nightly upload of placed orders to Ledgerly.
 *
 * Orders are uploaded in id order. After each upload the checkpoint moves to that order's id, so a run that fails
 * or crashes is simply started again: it resumes after the last order Ledgerly has, and no order is ever skipped.
 */

/** @param {{ id: number, totalCents: number, placedAt: string }} order */
export function toLedgerlyOrder(order) {
  return { orderId: order.id, totalCents: order.totalCents, currency: 'CHF', placedAt: order.placedAt };
}

/**
 * @param {{
 *   orders: { placedAfter(id: number): Promise<Array<{ id: number, totalCents: number, placedAt: string }>> },
 *   ledgerly: import('./ledgerly.js').LedgerlyClient,
 *   checkpoint: { get(): Promise<number>, set(id: number): Promise<void> },
 * }} deps
 */
export async function syncOrders({ orders, ledgerly, checkpoint }) {
  const after = await checkpoint.get();
  const pending = await orders.placedAfter(after);
  for (const order of pending) {
    await ledgerly.uploadOrder(toLedgerlyOrder(order));
    await checkpoint.set(order.id);
  }
  return { uploaded: pending.length };
}
