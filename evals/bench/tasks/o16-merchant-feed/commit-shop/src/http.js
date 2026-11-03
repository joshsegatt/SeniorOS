import { createServer as createHttpServer } from 'node:http';
import { createProductStore } from './catalog/products.js';
import { productPage } from './storefront/product-page.js';

/** Storefront HTTP server (products are loaded from the database at startup in the real deployment). */
export function createServer(store = createProductStore()) {
  return createHttpServer((req, res) => {
    const match = /^\/p\/([\w-]+)$/.exec(new URL(req.url ?? '/', 'http://localhost').pathname);
    const html = match ? productPage(store, match[1]) : null;
    res.writeHead(html ? 200 : 404, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html ?? '<h1>Not found</h1>');
  });
}
