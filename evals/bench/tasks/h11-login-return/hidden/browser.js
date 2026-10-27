// A tiny browser for the hidden tests: cookie jar, redirects, and submitting the login form the
// page actually renders (whatever hidden fields or form action the solution chose).
import { createWeb } from '../../src/web.js';

export const ORIGIN = 'https://shop.example';
const customers = { 'ada@example.com': { password: 'correct horse', customer: { id: 'c1', name: 'Ada' } } };
const login = (email, password) => (customers[email]?.password === password ? customers[email].customer : null);

const header = (res, name) => {
  const entry = Object.entries(res.headers ?? {}).find(([k]) => k.toLowerCase() === name);
  return entry ? entry[1] : undefined;
};

export const isRedirect = (res) => res.status >= 300 && res.status < 400 && header(res, 'location') !== undefined;

const decode = (s) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

const attr = (tag, name) => {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  return m ? decode(m[1] ?? m[2] ?? m[3]) : undefined;
};

/** The login form on a page: its action and the hidden fields it would submit. */
export function loginFormOf(html) {
  for (const m of String(html).matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)) {
    if (!/name\s*=\s*["']?password/i.test(m[2])) continue;
    const fields = {};
    for (const input of m[2].matchAll(/<input\b[^>]*>/gi)) {
      if ((attr(input[0], 'type') ?? '').toLowerCase() !== 'hidden') continue;
      const name = attr(input[0], 'name');
      if (name) fields[name] = attr(input[0], 'value') ?? '';
    }
    return { action: attr(`<form${m[1]}>`, 'action'), fields };
  }
  return null;
}

export function newBrowser() {
  const web = createWeb({ login });
  const jar = new Map();
  let current = `${ORIGIN}/`;

  const storeCookies = (res) => {
    const raw = header(res, 'set-cookie');
    for (const line of [raw ?? []].flat()) {
      const [pair, ...attrs] = String(line).split(';');
      const eq = pair.indexOf('=');
      if (eq < 0) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (!value || attrs.some((a) => /^\s*max-age\s*=\s*0\s*$/i.test(a))) jar.delete(name);
      else jar.set(name, value);
    }
  };

  /** One request; `offsite` is set when the target is not on the shop's origin. */
  async function send(method, target, body) {
    const url = new URL(target, current);
    if (url.origin !== ORIGIN) return { offsite: url.href };
    const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    const req = { method, url: url.pathname + url.search, headers: cookie ? { cookie } : {} };
    if (body) req.body = body;
    const res = await web.handle(req);
    storeCookies(res);
    current = url.href;
    return res;
  }

  /** GET and follow same-origin redirects. */
  async function open(target) {
    let res = await send('GET', target);
    for (let i = 0; i < 5 && !res.offsite && isRedirect(res); i++) res = await send('GET', header(res, 'location'));
    return res;
  }

  /** Fill in the login form on the current page and submit it. Does not follow the final redirect. */
  async function submitLogin(page, email = 'ada@example.com', password = 'correct horse') {
    const form = loginFormOf(page.body);
    if (!form) return { noForm: true, page };
    const action = form.action ? form.action : current;
    return send('POST', action, { ...form.fields, email, password });
  }

  /** Where a redirect response points, resolved like a browser would. */
  const target = (res) => new URL(header(res, 'location'), current);

  return { open, send, submitLogin, target, get current() { return current; } };
}
