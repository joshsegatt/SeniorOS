import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/http/app.js';

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

const SPELLINGS = [
  '/Admin/users',
  '/ADMIN/USERS',
  '//admin/users',
  '/admin//users',
  '/%61dmin/users',
  '/%41DMIN/users',
  '/./admin/users',
  '/account/../admin/users',
  '/products/%2e%2e/admin/users',
  '/admin/users/',
  '/admin/users?x=1',
];

test('the back office user list is refused to non-admins however the path is spelled', () => {
  const { app } = setup();
  for (const url of SPELLINGS) {
    for (const token of ['t-support', 't-ana', null]) {
      const res = app.handle({ method: 'GET', url, headers: token ? as(token) : {} });
      assert.ok(res.status === 401 || res.status === 403 || res.status === 404 || res.status === 400, `${url} as ${token}: got ${res.status}`);
      assert.ok(!JSON.stringify(res.body).includes('boss@shop.example'), `${url} as ${token}: leaked the user list`);
    }
  }
});

test('the back office dashboard is admins only too', () => {
  const { app } = setup();
  for (const url of ['/admin', '/Admin', '/admin/', '//admin', '/admin?tab=revenue']) {
    const res = app.handle({ method: 'GET', url, headers: as('t-support') });
    assert.ok(res.status >= 400, `${url}: got ${res.status}`);
    assert.ok(!JSON.stringify(res.body).includes('1234500'), `${url}: leaked revenue`);
  }
});

test('nobody else can change roles', () => {
  const { app, db } = setup();
  for (const url of ['/admin/users/u2/role', '/Admin/users/u2/role', '//admin/users/u2/role', '/%61dmin/users/u2/role', '/x/../admin/users/u2/role']) {
    const res = app.handle({ method: 'POST', url, headers: as('t-support'), body: { role: 'admin' } });
    assert.ok(res.status >= 400, `${url}: got ${res.status}`);
  }
  assert.equal(db.users.get('u2').role, 'support');
});

test('admins and everyone else keep working', () => {
  const { app } = setup();
  assert.equal(app.handle({ method: 'GET', url: '/admin/users', headers: as('t-admin') }).body.length, 3);
  assert.equal(app.handle({ method: 'GET', url: '/Admin/Users', headers: as('t-admin') }).status, 200);
  assert.deepEqual(app.handle({ method: 'GET', url: '/admin', headers: as('t-admin') }).body, { users: 3, revenueCents: 1234500 });
  assert.equal(app.handle({ method: 'GET', url: '/Products' }).status, 200);
  assert.equal(app.handle({ method: 'GET', url: '/account', headers: as('t-support') }).status, 200);
  assert.equal(app.handle({ method: 'GET', url: '/administrators-guide' }).status, 404);
});
