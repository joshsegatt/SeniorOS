const STATUS = { paid: 'paid', partially_refunded: 'partially refunded', refunded: 'refunded', pending: 'pending', voided: 'cancelled' };

/**
 * An order as the rest of our code uses it.
 * @param {any} raw order object from the shop platform API
 */
export function toOrder(raw) {
  return {
    number: String(raw.order_number),
    createdAt: raw.created_at,
    email: raw.customer?.email ?? '',
    currency: raw.currency,
    net: Number(raw.totals.net),
    vat: Number(raw.totals.tax),
    gross: Number(raw.totals.gross),
    status: STATUS[/** @type {keyof typeof STATUS} */ (raw.financial_status)] ?? raw.financial_status,
  };
}

/**
 * The admin order list: page `page` of the orders created in [from, to).
 * @param {ReturnType<import('./api.js').createShopApi>} api
 * @param {{ from: string, to: string, page?: number }} query
 */
export async function listOrders(api, { from, to, page = 1 }) {
  const res = await api.ordersPage({ from, to }, page);
  return { page, orders: res.data.map(toOrder), hasMore: Boolean(res.next_cursor) };
}
