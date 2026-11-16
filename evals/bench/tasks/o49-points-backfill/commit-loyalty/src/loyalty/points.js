/** @typedef {ReturnType<import('../db/store.js').createStore>} Store */

/** The loyalty program went live at this instant; paid orders placed since then earn points at checkout. */
export const POINTS_LAUNCH = '2026-11-03T00:00:00.000Z';

/** One point per whole euro paid. @param {{ totalCents: number }} order */
export const pointsFor = (order) => Math.floor(order.totalCents / 100);

/**
 * Writes a ledger entry and moves the customer's balance by the same amount. `customer.points` is the balance
 * shown at checkout and in the app; the ledger is the history behind it.
 * @param {Store} store
 * @param {{ customerId: string, orderId: string | null, type: 'earn' | 'redeem' | 'reverse', points: number }} entry
 * @param {() => Date} [now]
 */
export function addPoints(store, entry, now = () => new Date()) {
  const customer = store.get('customers', entry.customerId);
  if (!customer) throw new Error(`unknown customer ${entry.customerId}`);
  const saved = store.insert('ledger', { id: store.nextId('pt'), ...entry, at: now().toISOString() });
  store.replace('customers', customer.id, { ...customer, points: (customer.points ?? 0) + entry.points });
  return saved;
}

/**
 * Points for a paid order (called by placeOrder).
 * @param {Store} store
 * @param {{ id: string, customerId: string, totalCents: number, status: string }} order
 * @param {() => Date} [now]
 */
export function awardOrderPoints(store, order, now = () => new Date()) {
  if (order.status !== 'paid') return null;
  const points = pointsFor(order);
  if (points <= 0) return null;
  return addPoints(store, { customerId: order.customerId, orderId: order.id, type: 'earn', points }, now);
}

/**
 * The customer spends points at checkout (100 points = €1 off).
 * @param {Store} store
 * @param {string} customerId
 * @param {number} points
 * @param {string} orderId
 * @param {() => Date} [now]
 */
export function redeemPoints(store, customerId, points, orderId, now = () => new Date()) {
  if (!Number.isInteger(points) || points <= 0) throw new Error('points must be a positive integer');
  const customer = store.get('customers', customerId);
  if (!customer) throw new Error(`unknown customer ${customerId}`);
  if ((customer.points ?? 0) < points) throw new Error('not enough points');
  return addPoints(store, { customerId, orderId, type: 'redeem', points: -points }, now);
}
