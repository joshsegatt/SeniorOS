import { segmentsOf } from './router.js';

/** Looks up the session token; anonymous requests carry no user. */
export function authenticate(req, { sessions }) {
  const token = req.headers?.authorization?.replace(/^Bearer /, '');
  req.user = (token && sessions.get(token)) || null;
}

/** The back office under /admin is for admins only. */
export function requireAdmin(req) {
  // Decide on the path the router will match, not on the raw url: /Admin, //admin, /%61dmin, /x/../admin all reach it.
  let segments;
  try {
    segments = segmentsOf(req.path);
  } catch {
    return { status: 400, body: { error: 'bad url' } };
  }
  if (segments[0] === 'admin' && req.user?.role !== 'admin') {
    return { status: req.user ? 403 : 401, body: { error: 'admins only' } };
  }
  return null;
}
