import { createRouter } from './router.js';
import { authenticate, requireAdmin } from './auth.js';

/**
 * The shop's web backend: storefront API, account pages and the /admin back office.
 * `handle({ method, url, headers, body })` -> `{ status, body }`
 */
export function createApp({ db, sessions }) {
  const router = createRouter();

  router.add('GET', '/products', () => ({ status: 200, body: db.products }));
  router.add('GET', '/account', (req) => (req.user ? { status: 200, body: { id: req.user.id, email: db.users.get(req.user.id).email } } : { status: 401, body: { error: 'sign in' } }));

  router.add('GET', '/admin', () => ({ status: 200, body: { users: db.users.size, revenueCents: db.revenueCents } }));
  router.add('GET', '/admin/users', () => ({ status: 200, body: [...db.users.values()].map(({ id, email, role }) => ({ id, email, role })) }));
  router.add('POST', '/admin/users/:id/role', (req) => {
    const user = db.users.get(req.params.id);
    if (!user) return { status: 404, body: { error: 'no such user' } };
    user.role = req.body.role;
    return { status: 200, body: { id: user.id, role: user.role } };
  });

  return {
    handle({ method, url, headers = {}, body = null }) {
      const req = { method, url, path: url.split('?')[0], headers, body, user: null, params: {} };
      authenticate(req, { sessions });
      const denied = requireAdmin(req);
      if (denied) return denied;
      let found;
      try {
        found = router.match(method, req.path);
      } catch (err) {
        if (err instanceof URIError) return { status: 400, body: { error: 'bad url' } };
        throw err;
      }
      if (!found) return { status: 404, body: { error: 'not found' } };
      req.params = found.params;
      return found.handler(req);
    },
  };
}
