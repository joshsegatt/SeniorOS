import test from 'node:test';
import assert from 'node:assert/strict';
import { createWeb } from '../src/web.js';

const login = (email, password) => (email === 'ada@example.com' && password === 'correct horse' ? { id: 'c1', name: 'Ada' } : null);
const cookieFrom = (res) => res.headers['set-cookie'].split(';')[0];

test('home page is public', () => {
  const res = createWeb({ login }).handle({ method: 'GET', url: '/' });
  assert.equal(res.status, 200);
  assert.match(res.body, /Welcome/);
});

test('order pages need a login', () => {
  const res = createWeb({ login }).handle({ method: 'GET', url: '/orders/42' });
  assert.equal(res.status, 303);
  assert.match(res.headers.location, /^\/login/);
});

test('wrong password shows an error', () => {
  const res = createWeb({ login }).handle({ method: 'POST', url: '/login', body: { email: 'ada@example.com', password: 'nope' } });
  assert.equal(res.status, 401);
  assert.match(res.body, /Wrong email or password/);
});

test('logging in starts a session', () => {
  const web = createWeb({ login });
  const res = web.handle({ method: 'POST', url: '/login', body: { email: 'ada@example.com', password: 'correct horse' } });
  assert.equal(res.status, 303);
  const order = web.handle({ method: 'GET', url: '/orders/42', headers: { cookie: cookieFrom(res) } });
  assert.equal(order.status, 200);
  assert.match(order.body, /Order 42/);
});

test('logging out ends the session', () => {
  const web = createWeb({ login });
  const cookie = cookieFrom(web.handle({ method: 'POST', url: '/login', body: { email: 'ada@example.com', password: 'correct horse' } }));
  web.handle({ method: 'POST', url: '/logout', headers: { cookie } });
  assert.equal(web.handle({ method: 'GET', url: '/account', headers: { cookie } }).status, 303);
});
