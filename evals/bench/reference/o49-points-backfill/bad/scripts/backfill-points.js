import { pathToFileURL } from 'node:url';
import { openFileStore } from '../src/db/store.js';
import { POINTS_LAUNCH, awardOrderPoints } from '../src/loyalty/points.js';

const SINCE = '2026-01-01T00:00:00.000Z';

/**
 * One-off (2026-11): points for the paid orders placed in 2026 before the program went live.
 * Orders that already earned points are skipped, so running it twice is safe.
 * @param {ReturnType<import('../src/db/store.js').createStore>} store
 */
export function run(store) {
  const earned = new Set(store.all('ledger').filter((e) => e.type === 'earn').map((e) => e.orderId));
  let awarded = 0;
  for (const order of store.all('orders')) {
    if (order.placedAt < SINCE || order.placedAt >= POINTS_LAUNCH || earned.has(order.id)) continue;
    if (awardOrderPoints(store, order, () => new Date(order.placedAt))) awarded += 1;
  }
  return { awarded };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(run(openFileStore(process.env.STORE_FILE ?? 'data/store.json')));
}
