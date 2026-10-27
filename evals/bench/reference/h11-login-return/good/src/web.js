import { randomUUID } from 'node:crypto';

/**
 * Customer-facing pages of https://shop.example.
 *
 * `handle(req)` takes `{ method, url, headers?, body? }` and returns `{ status, headers, body }`.
 * `url` is the request target as the browser sent it (path and query string), `body` is the
 * parsed form of a POST, and header names are lowercase.
 *
 * @typedef {{ method: string, url: string, headers?: Record<string, string>, body?: Record<string, string> }} WebRequest
 * @typedef {{ status: number, headers: Record<string, string>, body: string }} WebResponse
 * @typedef {{ id: string, name: string }} Customer
 */

export const ORIGIN = 'https://shop.example';

/** @param {unknown} value */
export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** @param {number} status @param {string} title @param {string} content */
function page(status, title, content, headers = {}) {
  return {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
    body: `<!doctype html><title>${escapeHtml(title)} · bench-shop</title><main>${content}</main>`,
  };
}

/** @param {string} location */
function redirect(location, headers = {}) {
  return { status: 303, headers: { location, ...headers }, body: '' };
}

/**
 * Where to send the customer after login: a path on this site, otherwise the home page.
 * The value comes from the URL, so it is parsed the way a browser would parse it
 * (`//host`, `/\host`, `javascript:` and absolute URLs all leave the site).
 * @param {unknown} next
 */
export function safeNext(next) {
  if (typeof next !== 'string' || !next.startsWith('/')) return '/';
  let url;
  try {
    url = new URL(next, ORIGIN);
  } catch {
    return '/';
  }
  return url.origin === ORIGIN ? url.pathname + url.search : '/';
}

/** @param {string} error @param {string} next */
function loginForm(error = '', next = '/') {
  return [
    '<h1>Log in</h1>',
    error ? `<p class="error">${escapeHtml(error)}</p>` : '',
    '<form method="post" action="/login">',
    `<input type="hidden" name="next" value="${escapeHtml(next)}">`,
    '<label>Email <input type="email" name="email" required></label>',
    '<label>Password <input type="password" name="password" required></label>',
    '<button type="submit">Log in</button>',
    '</form>',
  ].join('');
}

/** @param {string | undefined} header */
function sessionId(header = '') {
  const match = /(?:^|;\s*)sid=([^;]+)/.exec(header);
  return match ? match[1] : null;
}

/**
 * @param {{ login: (email: string, password: string) => Customer | null }} deps
 *   `login` checks the credentials (accounts service) and returns the customer or null.
 */
export function createWeb({ login }) {
  /** @type {Map<string, Customer>} */
  const sessions = new Map();

  /** @param {WebRequest} req @returns {WebResponse} */
  function handle(req) {
    const url = new URL(req.url, ORIGIN);
    const headers = req.headers ?? {};
    const sid = sessionId(headers.cookie);
    const customer = sid ? sessions.get(sid) ?? null : null;
    const path = url.pathname;

    if (req.method === 'GET' && path === '/') {
      return page(200, 'Home', customer ? `<h1>Welcome back, ${escapeHtml(customer.name)}</h1>` : '<h1>Welcome</h1><a href="/login">Log in</a>');
    }

    if (req.method === 'GET' && path === '/login') {
      const next = url.searchParams.get('next') ?? '/';
      if (customer) return redirect(safeNext(next));
      return page(200, 'Log in', loginForm('', next));
    }

    if (req.method === 'POST' && path === '/login') {
      const { email = '', password = '', next = '/' } = req.body ?? {};
      const found = login(email, password);
      if (!found) return page(401, 'Log in', loginForm('Wrong email or password.', next));
      const newSid = randomUUID();
      sessions.set(newSid, found);
      return redirect(safeNext(next), { 'set-cookie': `sid=${newSid}; HttpOnly; Secure; SameSite=Lax; Path=/` });
    }

    if (req.method === 'POST' && path === '/logout') {
      if (sid) sessions.delete(sid);
      return redirect('/', { 'set-cookie': 'sid=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0' });
    }

    // Everything below needs a logged-in customer.
    const protectedPage = path === '/orders' || path === '/account' || /^\/orders\/[\w-]+$/.test(path);
    if (!protectedPage) return page(404, 'Not found', '<h1>Page not found</h1>');
    if (!customer) return redirect(`/login?next=${encodeURIComponent(path + url.search)}`);

    if (req.method === 'GET' && path === '/orders') return page(200, 'Your orders', '<h1>Your orders</h1>');
    if (req.method === 'GET' && path.startsWith('/orders/')) {
      const id = path.slice('/orders/'.length);
      return page(200, `Order ${id}`, `<h1>Order ${escapeHtml(id)}</h1>`);
    }
    if (req.method === 'GET' && path === '/account') return page(200, 'Account', `<h1>${escapeHtml(customer.name)}</h1>`);
    return page(405, 'Method not allowed', '<h1>Method not allowed</h1>');
  }

  return { handle };
}
