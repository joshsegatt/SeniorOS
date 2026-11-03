import { createServer as createHttpServer } from 'node:http';
import { createOrderStore } from './orders/store.js';
import { dailySales } from './reports/daily.js';

/** Back-office HTTP API (orders are loaded from the database at startup in the real deployment). */
export function createServer(store = createOrderStore()) {
  return createHttpServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const day = url.searchParams.get('day');
    if (url.pathname === '/reports/daily' && day && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(dailySales(store, day)));
      return;
    }
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });
}
