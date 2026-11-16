/** @typedef {ReturnType<import('../db/store.js').createStore>} Store */

/** A customer's ledger entries, oldest first. @param {Store} store @param {string} customerId */
export function ledgerFor(store, customerId) {
  return store
    .all('ledger')
    .filter((e) => e.customerId === customerId)
    .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
}

/** The balance the ledger adds up to. @param {Store} store @param {string} customerId */
export function ledgerBalance(store, customerId) {
  return ledgerFor(store, customerId).reduce((sum, e) => sum + e.points, 0);
}

/**
 * The points page in the app: balance and history.
 * @param {Store} store
 * @param {string} customerId
 */
export function pointsStatement(store, customerId) {
  const customer = store.get('customers', customerId);
  if (!customer) throw new Error(`unknown customer ${customerId}`);
  return {
    customerId,
    balance: customer.points ?? 0,
    entries: ledgerFor(store, customerId).map((e) => ({ at: e.at, type: e.type, orderId: e.orderId, points: e.points })),
  };
}

/** Nightly check: customers whose balance does not match their ledger. @param {Store} store */
export function balanceMismatches(store) {
  return store
    .all('customers')
    .map((c) => ({ customerId: c.id, balance: c.points ?? 0, ledger: ledgerBalance(store, c.id) }))
    .filter((row) => row.balance !== row.ledger);
}
