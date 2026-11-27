import { systemClock, dayOf } from './clock.js';

/** Every write path into the ledger. Each one must keep the dashboard fresh (docs/caching.md rule 2). */
export function createSalesService({ ledger, dashboard, clock = systemClock }) {
  function recordSale({ storeId, amountCents, orderId }) {
    const day = dayOf(clock.now());
    ledger.append({ storeId, day, type: 'sale', amountCents, ref: orderId });
    dashboard.invalidate(storeId, day);
  }

  /** Refunds are booked on the day they happen, not on the sale's day. */
  function recordRefund({ storeId, amountCents, orderId }) {
    const day = dayOf(clock.now());
    ledger.append({ storeId, day, type: 'refund', amountCents, ref: orderId });
  }

  /** POS batch import: rows carry their own storeId and day. */
  function importBatch(rows) {
    const touched = new Map();
    for (const row of rows) {
      ledger.append(row);
      touched.set(`${row.storeId}|${row.day}`, row);
    }
    for (const row of touched.values()) dashboard.invalidate(row.storeId, row.day);
    return { imported: rows.length };
  }

  return { recordSale, recordRefund, importBatch };
}
