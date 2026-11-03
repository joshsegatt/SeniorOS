import { formatDate } from '../format.js';

const PAGE_SIZE = 10;

/**
 * The "My orders" page of the customer account.
 * @param {ReturnType<typeof import('./store.js').createOrderStore>} store
 * @param {string} customerId
 * @param {number} [page] 1-based
 */
export function orderHistory(store, customerId, page = 1) {
  const total = store.countFor(customerId);
  const rows = store.ordersFor(customerId, { offset: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE }).map((o) => ({
    id: o.id,
    date: formatDate(new Date(o.placedAt)),
    items: o.lines.reduce((n, l) => n + l.qty, 0),
    totalCents: o.totalCents,
    status: o.status,
  }));
  return { page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), rows };
}
