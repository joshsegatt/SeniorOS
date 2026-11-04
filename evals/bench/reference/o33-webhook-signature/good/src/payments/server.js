import { createServer as createHttpServer } from 'node:http';
import { handleWebhook } from './webhooks.js';

/**
 * The Paylane webhook endpoint, POST /webhooks/paylane.
 * @param {{ secret: string, onEvent: (event: any) => void, nowSec?: () => number }} opts
 */
export function createServer(opts) {
  return createHttpServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/webhooks/paylane') {
      res.writeHead(404).end();
      return;
    }
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        res.writeHead(400).end('invalid json');
        return;
      }
      const out = handleWebhook({ headers: req.headers, body, rawBody: raw }, { secret: opts.secret, onEvent: opts.onEvent, nowSec: opts.nowSec?.() });
      res.writeHead(out.status, { 'content-type': 'text/plain' }).end(out.body);
    });
  });
}
