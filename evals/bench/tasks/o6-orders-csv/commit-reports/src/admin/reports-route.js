import { findReport, reports } from '../reports/index.js';

const CONTENT_TYPES = { json: 'application/json', csv: 'text/csv; charset=utf-8' };

/**
 * Admin routes for the Reports menu.
 *   GET /reports            -> the menu: [{ id, title }]
 *   GET /reports/:id?k=v    -> runs the report; JSON reports are serialized, CSV reports are sent as a download
 * @param {{ loadOrders: () => import('../orders/orders.js').Order[] }} deps
 */
export function createReportsRoute({ loadOrders }) {
  /** @param {{ method: string, path: string, query?: Record<string, string> }} req */
  return function handle(req) {
    if (req.method !== 'GET') return { status: 405, headers: {}, body: 'method not allowed' };
    if (req.path === '/reports') {
      const menu = reports.map((r) => ({ id: r.id, title: r.title })).sort((a, b) => a.title.localeCompare(b.title));
      return { status: 200, headers: { 'content-type': CONTENT_TYPES.json }, body: JSON.stringify(menu) };
    }
    const match = /^\/reports\/([\w-]+)$/.exec(req.path);
    const report = match && findReport(match[1]);
    if (!report) return { status: 404, headers: {}, body: 'not found' };

    let result;
    try {
      result = report.run(loadOrders(), { ...(req.query ?? {}) });
    } catch (err) {
      if (err instanceof RangeError) return { status: 400, headers: {}, body: err.message };
      throw err;
    }
    const headers = { 'content-type': CONTENT_TYPES[report.format] };
    if (report.format === 'csv') {
      headers['content-disposition'] = `attachment; filename="${report.id}.csv"`;
      return { status: 200, headers, body: String(result) };
    }
    return { status: 200, headers, body: JSON.stringify(result) };
  };
}
