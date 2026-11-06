/** @typedef {{ status: number, body: unknown }} Response */
/** @typedef {{ method: string, path: string, headers?: Record<string, string>, body?: unknown }} Request */
/** @typedef {ReturnType<import('./kv.js').createMemoryKv>} Kv */

/** @param {Request} req */
function keyOf(req) {
  const value = req.headers?.['idempotency-key'];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Run `handler` at most once per Idempotency-Key and route. A retried request gets the original response back; the
 * same key with a different body is refused. 5xx responses are not kept, so a retry after an outage runs again.
 * Requests without a key run every time.
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

  const saved = await kv.get(recordKey);
  if (saved) {
    if (saved.fingerprint !== fingerprint) return { status: 422, body: { error: 'Idempotency-Key was already used for a different request' } };
    return saved.response;
  }

  const response = await handler();
  if (response.status < 500) await kv.set(recordKey, { fingerprint, response, savedAt: new Date().toISOString() });
  return response;
}
