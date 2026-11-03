/** Looks up the session token; anonymous requests carry no user. */
export function authenticate(req, { sessions }) {
  const token = req.headers?.authorization?.replace(/^Bearer /, '');
  req.user = (token && sessions.get(token)) || null;
}

/** The back office under /admin is for admins only. */
export function requireAdmin(req) {
  if (req.path.startsWith('/admin/') && req.user?.role !== 'admin') {
    return { status: req.user ? 403 : 401, body: { error: 'admins only' } };
  }
  return null;
}
