export const PAGE_SIZE = 100;

/**
 * Client for the shop platform's REST API (v2).
 * `http.get(path, query)` resolves to the parsed JSON body; see src/shop/http.js.
 * @param {{ get(path: string, query?: Record<string, unknown>): Promise<any> }} http
 */
export function createShopApi(http) {
  const api = {
    /**
     * Orders created in [from, to), oldest first: `limit` orders after `cursor` (null for the start).
     * @param {{ from: string, to: string, cursor?: string | null, limit?: number, fields?: string }} query
     * @returns {Promise<{ data: any[], next_cursor: string | null }>}
     */
    listOrders({ from, to, cursor = null, limit = PAGE_SIZE, fields }) {
      return http.get('/v2/orders', { created_from: from, created_to: to, cursor, limit, fields });
    },

    /**
     * Page `page` (1-based) of the orders created in [from, to).
     * @param {{ from: string, to: string }} range
     * @param {number} page
     * @param {number} [limit]
     */
    async ordersPage(range, page, limit = PAGE_SIZE) {
      let cursor = null;
      for (let p = 1; p < page; p += 1) {
        const skipped = await api.listOrders({ ...range, cursor, limit, fields: 'id' });
        if (!skipped.next_cursor) return { data: [], next_cursor: null };
        cursor = skipped.next_cursor;
      }
      return api.listOrders({ ...range, cursor, limit });
    },

    /** @param {string} number */
    getOrder(number) {
      return http.get(`/v2/orders/${encodeURIComponent(number)}`);
    },
  };
  return api;
}
