import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// The order archive: one JSON file per placed order in data/orders/. Saved orders are the record of what was sold
// and are kept as they were written; the archive goes back to the shop's first order.

/**
 * @typedef {{ id: string, region: 'CH' | 'DE' | 'US', placedAt: string, lines: import('./orders.js').OrderLine[] }} SavedOrder
 */

/**
 * @param {string} dir
 * @param {SavedOrder} order
 */
export function saveOrder(dir, order) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${order.id}.json`), `${JSON.stringify(order, null, 2)}\n`);
}

/**
 * Every saved order, oldest first.
 * @param {string} dir
 * @returns {SavedOrder[]}
 */
export function loadOrders(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => upgrade(JSON.parse(readFileSync(join(dir, f), 'utf8'))));
}

/** Orders saved before the rename name the unit price `priceCents`; the files are kept as written. */
function upgrade(order) {
  const lines = order.lines.map(({ priceCents, ...line }) => (line.unitPriceCents === undefined && priceCents !== undefined ? { ...line, unitPriceCents: priceCents } : line));
  return { ...order, lines };
}
