import { createLedger } from './ledger.js';
import { createDashboard } from './dashboard.js';
import { createSalesService } from './sales-service.js';
import { systemClock } from './clock.js';

/** Wires the app. `req` is { method, path, query?, body? }; returns { status, body }. */
export function createDashboardApp({ clock = systemClock, ledger = createLedger() } = {}) {
  const dashboard = createDashboard({ ledger, clock });
  const sales = createSalesService({ ledger, dashboard, clock });

  function handle(req) {
    try {
      if (req.method === 'GET' && req.path === '/dashboard') {
        if (!req.query?.store) return { status: 400, body: { error: 'store is required' } };
        return { status: 200, body: dashboard.dailySummary(req.query.store, req.query.day) };
      }
      if (req.method === 'POST' && req.path === '/sales') {
        sales.recordSale(req.body);
        return { status: 201, body: { ok: true } };
      }
      if (req.method === 'POST' && req.path === '/refunds') {
        sales.recordRefund(req.body);
        return { status: 201, body: { ok: true } };
      }
      if (req.method === 'POST' && req.path === '/imports') {
        return { status: 201, body: sales.importBatch(req.body?.rows ?? []) };
      }
      return { status: 404, body: { error: 'not_found' } };
    } catch (err) {
      if (err instanceof TypeError || err instanceof RangeError) return { status: 400, body: { error: err.message } };
      throw err;
    }
  }

  return { handle, dashboard, sales, ledger };
}
