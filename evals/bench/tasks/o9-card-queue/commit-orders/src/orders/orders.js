/**
 * @param {ReturnType<import('./store.js').createOrderStore>} store
 * @param {{ customerId: string, totalCents: number }} input
 * @param {Date} now
 */
export function placeOrder(store, input, now) {
  if (!Number.isInteger(input.totalCents) || input.totalCents <= 0) throw new Error('invalid total');
  return store.insert({ id: store.nextId(), customerId: input.customerId, totalCents: input.totalCents, status: 'pending', placedAt: now.toISOString() });
}

/**
 * Finance marks an order paid when the bank transfer arrives.
 * @param {ReturnType<import('./store.js').createOrderStore>} store
 * @param {string} id
 * @param {Date} now
 */
export function markPaidByTransfer(store, id, now) {
  const order = store.get(id);
  if (!order) throw new Error(`unknown order ${id}`);
  if (order.status !== 'pending') throw new Error(`order ${id} is ${order.status}`);
  return store.update(id, { status: 'paid', paymentMethod: 'transfer', paidAt: now.toISOString() });
}

/**
 * @param {ReturnType<import('./store.js').createOrderStore>} store
 * @param {string} id
 * @param {Date} now
 */
export function markShipped(store, id, now) {
  const order = store.get(id);
  if (order?.status !== 'paid') throw new Error(`order ${id} is not ready to ship`);
  return store.update(id, { status: 'shipped', shippedAt: now.toISOString() });
}

const REFUND_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Customers can ask for a refund within 30 days of paying.
 * @param {import('./store.js').Order} order
 * @param {Date} now
 */
export function refundWindowOpen(order, now) {
  if (!order.paidAt || order.status === 'refunded') return false;
  return now.getTime() - Date.parse(order.paidAt) <= REFUND_WINDOW_MS;
}

/** What the customer sees in "My orders". @param {import('./store.js').Order} order */
export function customerOrderView(order) {
  /** @param {string | undefined} iso */
  const day = (iso) => (iso ? iso.slice(0, 10) : null);
  return { id: order.id, status: order.status, totalCents: order.totalCents, placedOn: day(order.placedAt), paidOn: day(order.paidAt), refundedOn: day(order.refundedAt) };
}
