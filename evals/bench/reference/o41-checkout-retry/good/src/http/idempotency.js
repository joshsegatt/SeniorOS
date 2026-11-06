/** @typedef {{ status: number, body: unknown }} Response */
/** @typedef {{ method: string, path: string, headers?: Record<string, string>, body?: unknown }} Request */
/** @typedef {ReturnType<import('./kv.js').createMemoryKv>} Kv */

/** @param {Request} req */
function keyOf(req) {
  const value = req.headers?.['idempotency-key'];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Requests still running, per store and key. Claimed synchronously, before any await, so a retry that arrives while
 * the first request is still running cannot start a second one. (The app is a single process.)
 * @type {WeakMap<Kv, Map<string, { fingerprint: string, response: Promise<Response> }>>}
 */
const inFlight = new WeakMap();

/**
 * Run `handler` at most once per Idempotency-Key and route. A retried request gets the original response back, also
 * when it arrives while the first one is still running; the same key with a different body is refused. 5xx
 * responses are not kept, so a retry after an outage runs again. Requests without a key run every time.
 * @param {Kv} kv
 * @param {Request} req
 * @param {() => Promise<Response>} handler
 * @returns {Promise<Response>}
 */
export async function withIdempotency(kv, req, handler) {
  const key = keyOf(req);
  if (!key) return handler();
  const recordKey = `idem:${req.method} ${req.path}:${key}`;
  const fingerprint = JSON.stringify(req.body ?? null);
  const mismatch = { status: 422, body: { error: 'Idempotency-Key was already used for a different request' } };

  let running = inFlight.get(kv);
  if (!running) {
    running = new Map();
    inFlight.set(kv, running);
  }
  const current = running.get(recordKey);
  if (current) return current.fingerprint === fingerprint ? current.response : mismatch;

  const response = (async () => {
    const saved = await kv.get(recordKey);
    if (saved) return saved.fingerprint === fingerprint ? saved.response : mismatch;
    const fresh = await handler();
    if (fresh.status < 500) await kv.set(recordKey, { fingerprint, response: fresh, savedAt: new Date().toISOString() });
    return fresh;
  })();
  running.set(recordKey, { fingerprint, response });
  try {
    return await response;
  } finally {
    running.delete(recordKey);
  }
}
