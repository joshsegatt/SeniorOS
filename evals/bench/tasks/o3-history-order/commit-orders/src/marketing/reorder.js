/**
 * "Buy again" box on the home page.
 * @param {ReturnType<typeof import('../orders/store.js').createOrderStore>} store
 * @param {string} customerId
 */
export function buyAgain(store, customerId) {
  const orders = store.ordersFor(customerId).filter((o) => o.status !== 'cancelled');
  const last = orders.at(-1);
  if (!last) return null;
  return { fromOrder: last.id, items: last.lines.map((l) => ({ sku: l.sku, qty: l.qty })) };
}
