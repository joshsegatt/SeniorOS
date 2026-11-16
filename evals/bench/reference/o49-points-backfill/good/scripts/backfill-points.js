import { pathToFileURL } from 'node:url';
import { openFileStore } from '../src/db/store.js';
import { POINTS_LAUNCH, pointsFor } from '../src/loyalty/points.js';
import { ledgerBalance } from '../src/loyalty/ledger.js';

const SINCE = '2026-01-01T00:00:00.000Z';

/**
 * One-off (2026-11): points for the paid orders placed in 2026 before the program went live.
 * Safe to run again: an order that already has an earn entry is skipped, and balances are set from the ledger,
 * so a run that stopped between the two writes is finished by the next one.
 * @param {ReturnType<import('../src/db/store.js').createStore>} store
 */
export function run(store) {
  const earned = new Set(store.all('ledger').filter((e) => e.type === 'earn').map((e) => e.orderId));
  let awarded = 0;
  for (const order of store.all('orders')) {
    if (order.placedAt < SINCE || order.placedAt >= POINTS_LAUNCH || order.status !== 'paid' || earned.has(order.id)) continue;
    const points = pointsFor(order);
    if (points <= 0) continue;
    store.insert('ledger', { id: `pt-backfill-${order.id}`, customerId: order.customerId, orderId: order.id, type: 'earn', points, at: order.placedAt });
    awarded += 1;
  }
  let balances = 0;
  for (const customer of store.all('customers')) {
    const points = ledgerBalance(store, customer.id);
    if ((customer.points ?? 0) === points) continue;
    store.replace('customers', customer.id, { ...customer, points });
    balances += 1;
  }
  return { awarded, balances };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(run(openFileStore(process.env.STORE_FILE ?? 'data/store.json')));
}
