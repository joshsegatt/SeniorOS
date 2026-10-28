/**
 * Nightly upload of placed orders to Ledgerly.
 *
 * Orders are uploaded in parallel, at most CONCURRENCY at a time (Ledgerly allows 4 requests in flight per key).
 * The checkpoint only moves over a contiguous prefix of uploaded orders, so a run that fails or crashes is simply
 * started again: it resumes after the last order Ledgerly is known to have, and no order is ever skipped. Orders
 * past the checkpoint may already be in Ledgerly from the failed run; Ledgerly answers 409 for those, which counts
 * as uploaded.
 */
import { LedgerlyError } from './ledgerly.js';

const CONCURRENCY = 4;

/** @param {{ id: number, totalCents: number, placedAt: string }} order */
export function toLedgerlyOrder(order) {
  return { orderId: order.id, totalCents: order.totalCents, currency: 'CHF', placedAt: order.placedAt };
}

async function upload(ledgerly, order) {
  try {
    await ledgerly.uploadOrder(toLedgerlyOrder(order));
  } catch (err) {
    if (err instanceof LedgerlyError && err.status === 409) return; // uploaded by an earlier, failed run
    throw err;
  }
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
  let watermark = 0; // index of the first order not known to be uploaded
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
        await upload(ledgerly, pending[i]);
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
