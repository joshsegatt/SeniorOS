/**
 * Minimal in-memory user API. `handle` takes a request object and returns { status, body }.
 * @typedef {{ id: string, name: string, role: 'admin' | 'member' }} User
 * @typedef {{ method: string, path: string, headers?: Record<string, string>, body?: any }} Request
 */

export function defaultSeed() {
  return {
    users: [
      { id: 'u1', name: 'Ada', role: 'admin' },
      { id: 'u2', name: 'Bob', role: 'member' },
      { id: 'u3', name: 'Cy', role: 'member' },
    ],
    tokens: { 'tok-admin': 'u1', 'tok-bob': 'u2' },
  };
}

/** Profile fields a user may change. `id` and `role` are never taken from a request body. */
const EDITABLE_FIELDS = ['name'];

export function createApp(seed = defaultSeed()) {
  /** @type {Map<string, User>} */
  const users = new Map(seed.users.map((u) => [u.id, { ...u }]));
  /** @type {Record<string, string>} */
  const tokens = { ...seed.tokens };

  /** @param {Record<string, string>} headers */
  function authenticate(headers) {
    const header = headers.authorization ?? headers.Authorization ?? '';
    const match = /^Bearer (\S+)$/.exec(header);
    if (!match) return null;
    const userId = tokens[match[1]];
    return userId ? users.get(userId) ?? null : null;
  }

  /** @param {Request} req */
  function handle(req) {
    const user = authenticate(req.headers ?? {});
    if (!user) return { status: 401, body: { error: 'unauthenticated' } };

    if (req.method === 'GET' && req.path === '/users') {
      return { status: 200, body: [...users.values()] };
    }

    const byId = /^\/users\/([\w-]+)$/.exec(req.path);
    if (req.method === 'GET' && byId) {
      const found = users.get(byId[1]);
      return found ? { status: 200, body: found } : { status: 404, body: { error: 'not found' } };
    }

    if (req.method === 'PATCH' && byId) {
      if (user.role !== 'admin' && user.id !== byId[1]) return { status: 403, body: { error: 'forbidden' } };
      const target = users.get(byId[1]);
      if (!target) return { status: 404, body: { error: 'not found' } };
      const body = req.body;
      if (!body || typeof body !== 'object') return { status: 400, body: { error: 'invalid body' } };
      const unknown = Object.keys(body).filter((k) => !EDITABLE_FIELDS.includes(k));
      if (unknown.length) return { status: 400, body: { error: `cannot change: ${unknown.join(', ')}` } };
      if ('name' in body && (typeof body.name !== 'string' || !body.name.trim())) {
        return { status: 400, body: { error: 'name must be a non-empty string' } };
      }
      if ('name' in body) target.name = body.name.trim();
      return { status: 200, body: target };
    }

    return { status: 404, body: { error: 'not found' } };
  }

  return { handle };
}
