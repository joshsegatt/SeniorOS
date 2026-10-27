import test from 'node:test';
import assert from 'node:assert/strict';
import { ORIGIN, isRedirect, newBrowser } from './browser.js';

/** Open `start` logged out, log in on the page we land on, and return where the login redirects to. */
async function loginFrom(start) {
  const b = newBrowser();
  const page = await b.open(start);
  assert.ok(!page.offsite, `opening ${start} left the site: ${page.offsite}`);
  const res = await b.submitLogin(page);
  assert.ok(!res.noForm, `no login form after opening ${start} (status ${page.status})`);
  return { b, res };
}

/**
 * The login URL the shop generates for a protected page, and the query parameter (if any) that
 * carries the page. Attacks reuse exactly that parameter, whatever the solution named it.
 */
async function returnParam() {
  const b = newBrowser();
  const res = await b.send('GET', '/orders/42');
  assert.ok(isRedirect(res), 'a protected page no longer redirects to login');
  const url = b.target(res);
  const param = [...url.searchParams].find(([, v]) => v.includes('/orders/42'))?.[0];
  return { loginPath: url.pathname, param };
}

async function attackUrl(value) {
  const { loginPath, param } = await returnParam();
  return `${loginPath}?${new URLSearchParams({ [param ?? 'next']: value })}`;
}

test('after logging in, the customer is back on the order page they opened', async () => {
  const { b, res } = await loginFrom('/orders/42');
  assert.ok(isRedirect(res), `login answered ${res.status}`);
  const to = b.target(res);
  assert.equal(to.origin, ORIGIN);
  assert.equal(to.pathname, '/orders/42');
  const order = await b.open(to.href);
  assert.equal(order.status, 200, 'the session does not work after the redirect');
  assert.match(order.body, /Order 42/);
});

test('works for other protected pages, keeping or dropping the query string', async () => {
  const { b, res } = await loginFrom('/orders/77?tab=items');
  const to = b.target(res);
  assert.equal(to.origin, ORIGIN);
  assert.equal(to.pathname, '/orders/77');
  assert.ok(['', '?tab=items'].includes(to.search), `unexpected query ${to.search}`);

  const account = await loginFrom('/account');
  assert.equal(account.b.target(account.res).pathname, '/account');
});

test('logging in from the login page itself still lands on the home page', async () => {
  const { b, res } = await loginFrom('/login');
  assert.ok(isRedirect(res));
  assert.equal(b.target(res).href, `${ORIGIN}/`);
});

const OFFSITE = [
  'https://evil.example/login',
  '//evil.example/login',
  '/\\evil.example/login',
  '\\\\evil.example/login',
  'javascript:alert(document.cookie)',
  'https://shop.example.evil.example/',
  'https://shop.example@evil.example/',
];

for (const value of OFFSITE) {
  test(`a crafted login link cannot send customers to another site: ${value}`, async () => {
    const start = await attackUrl(value);
    const b = newBrowser();
    const page = await b.open(start);
    assert.ok(!page.offsite, `the login page redirected to ${page.offsite}`);
    const res = await b.submitLogin(page);
    if (res.noForm || !isRedirect(res)) return; // rejected or not redirected: safe
    const to = b.target(res);
    assert.equal(to.origin, ORIGIN, `after login the customer is sent to ${to.href}`);
    assert.equal(to.protocol, 'https:');
  });
}

test('the return target is not reflected into the login page as HTML', async () => {
  for (const payload of ['/"><script>alert(1)</script>', "/'><img src=x onerror=alert(1)>", '/orders/1"><svg onload=alert(1)>']) {
    const b = newBrowser();
    const page = await b.open(await attackUrl(payload));
    if (page.offsite || typeof page.body !== 'string') continue;
    assert.ok(!/<script>alert\(1\)|<img src=x|<svg onload/i.test(page.body), `login page reflects ${payload} unescaped`);
  }
});
