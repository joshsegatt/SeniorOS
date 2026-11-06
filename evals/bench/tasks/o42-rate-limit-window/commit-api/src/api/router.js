import { createRateLimiter } from '../limits/rate-limiter.js';
import { defaultKeys, resolveKey } from './keys.js';

const CATALOGUE = [
  { sku: 'TENT-2P', name: 'Two-person tent', priceCents: 18900, stock: 14 },
  { sku: 'MAT-AIR', name: 'Air sleeping mat', priceCents: 6400, stock: 0 },
  { sku: 'STOVE-1', name: 'Camping stove', priceCents: 4500, stock: 31 },
];

/**
 * Public catalogue API. Each API key may make at most 10 requests in any one-second period.
 * @param {{ keys?: ReturnType<typeof defaultKeys>, now?: () => number }} [options]
 */
export function createApi({ keys = defaultKeys(), now = Date.now } = {}) {
  const limiter = createRateLimiter({ limit: 10, windowMs: 1000, now });

  /** @param {{ method: string, path: string, headers?: Record<string, string> }} req */
  function handle(req) {
    const client = resolveKey(keys, req.headers);
    if (!client) return { status: 401, body: { error: 'missing or unknown API key' } };
    if (!limiter.hit(client.key)) return { status: 429, body: { error: 'rate limit exceeded' } };

    if (req.method === 'GET' && req.path === '/v1/products') {
      return { status: 200, body: CATALOGUE.map(({ stock, ...p }) => p) };
    }
    const sku = /^\/v1\/products\/([A-Z0-9-]+)\/stock$/.exec(req.path)?.[1];
    if (req.method === 'GET' && sku) {
      if (!client.scopes.includes('stock:read')) return { status: 403, body: { error: 'missing scope stock:read' } };
      const product = CATALOGUE.find((p) => p.sku === sku);
      return product ? { status: 200, body: { sku, stock: product.stock } } : { status: 404, body: { error: 'unknown sku' } };
    }
    return { status: 404, body: { error: 'not found' } };
  }

  return { handle };
}
