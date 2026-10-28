/**
 * Nightly upload of placed orders to Ledgerly.
 *
 * Orders are uploaded in parallel by a pool of CONCURRENCY workers (Ledgerly allows at most 4 requests in flight
 * per API key). The checkpoint only moves over the contiguous prefix of uploaded orders, so a run that fails or
 * crashes is simply started again: it resumes after the last order Ledgerly has, and no order is ever skipped.
 */

const CONCURRENCY = 4;

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
  const done = new Array(pending.length).fill(false);
  let watermark = 0;
  let next = 0;
  let failure = null;
  let saving = Promise.resolve();

  const advance = () => {
    const from = watermark;
    while (watermark < pending.length && done[watermark]) watermark += 1;
    if (watermark > from) {
      const id = pending[watermark - 1].id;
      saving = saving.then(() => checkpoint.set(id));
    }
  };

  const worker = async () => {
    while (!failure && next < pending.length) {
      const i = next++;
      try {
        await ledgerly.uploadOrder(toLedgerlyOrder(pending[i]));
      } catch (err) {
        failure ??= err;
        return;
      }
      done[i] = true;
      advance();
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pending.length) }, worker));
  await saving;
  if (failure) throw failure;
  return { uploaded: pending.length };
}
