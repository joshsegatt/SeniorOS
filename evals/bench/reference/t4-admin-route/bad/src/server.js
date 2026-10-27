/**
 * Minimal in-memory user API. `handle` takes a request object and returns { status, body }.
 * @typedef {{ id: string, name: string, role: 'admin' | 'member' }} User
 * @typedef {{ method: string, path: string, headers?: Record<string, string> }} Request
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

    // Authenticated is not the same as authorized: any member can delete here.
    if (req.method === 'DELETE' && byId) {
      if (!users.delete(byId[1])) return { status: 404, body: { error: 'not found' } };
      return { status: 204, body: null };
    }

    return { status: 404, body: { error: 'not found' } };
  }

  return { handle };
}
