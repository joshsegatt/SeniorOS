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
  const users = new Map(seed.users.map((u) => [u.id, { ...u }]));
  const tokens = { ...seed.tokens };

  const authenticate = (headers) => {
    const match = /^Bearer (\S+)$/.exec(headers.authorization ?? headers.Authorization ?? '');
    return match ? users.get(tokens[match[1]]) ?? null : null;
  };

  /** @param {Request} req */
  function handle(req) {
    const user = authenticate(req.headers ?? {});
    if (!user) return { status: 401, body: { error: 'unauthenticated' } };

    if (req.method === 'GET' && req.path === '/me') return { status: 200, body: user };
    if (req.method === 'GET' && req.path === '/users') return { status: 200, body: [...users.values()] };

    const byId = /^\/users\/([\w-]+)$/.exec(req.path);
    if (req.method === 'GET' && byId) {
      const found = users.get(byId[1]);
      return found ? { status: 200, body: found } : { status: 404, body: { error: 'not found' } };
    }

    return { status: 404, body: { error: 'not found' } };
  }

  return { handle };
}
