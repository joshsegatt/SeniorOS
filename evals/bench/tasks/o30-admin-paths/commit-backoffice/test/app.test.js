import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/http/app.js';

function setup() {
  const db = {
    products: [{ sku: 'MUG', priceCents: 1200 }],
    revenueCents: 1234500,
    users: new Map([
      ['u1', { id: 'u1', email: 'boss@shop.example', role: 'admin' }],
      ['u2', { id: 'u2', email: 'sam@shop.example', role: 'support' }],
      ['u3', { id: 'u3', email: 'ana@example.com', role: 'customer' }],
    ]),
  };
  const sessions = new Map([['t-admin', db.users.get('u1')], ['t-support', db.users.get('u2')], ['t-ana', db.users.get('u3')]]);
  return { db, app: createApp({ db, sessions }) };
}
const as = (token) => ({ authorization: `Bearer ${token}` });

test('storefront and account pages', () => {
  const { app } = setup();
  assert.equal(app.handle({ method: 'GET', url: '/products' }).status, 200);
  assert.deepEqual(app.handle({ method: 'GET', url: '/account', headers: as('t-ana') }).body, { id: 'u3', email: 'ana@example.com' });
  assert.equal(app.handle({ method: 'GET', url: '/account' }).status, 401);
  assert.equal(app.handle({ method: 'GET', url: '/Products' }).status, 200, 'old links use capitals');
});

test('admins use the back office', () => {
  const { app, db } = setup();
  assert.equal(app.handle({ method: 'GET', url: '/admin/users', headers: as('t-admin') }).body.length, 3);
  assert.deepEqual(app.handle({ method: 'POST', url: '/admin/users/u2/role', headers: as('t-admin'), body: { role: 'admin' } }).body, { id: 'u2', role: 'admin' });
  assert.equal(db.users.get('u2').role, 'admin');
});

test('others are kept out of the back office', () => {
  const { app } = setup();
  assert.equal(app.handle({ method: 'GET', url: '/admin/users', headers: as('t-support') }).status, 403);
  assert.equal(app.handle({ method: 'GET', url: '/admin/users' }).status, 401);
});
