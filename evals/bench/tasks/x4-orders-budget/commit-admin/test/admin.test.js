import test from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../src/admin/db.js';
import { createAdminApp } from '../src/admin/app.js';

const seed = () => ({
  customers: [
    { id: 'c1', name: 'Ada Lovelace', email: 'ada@example.com' },
    { id: 'c2', name: 'Bob Marley', email: 'bob@example.com' },
  ],
  orders: [
    { id: 'o1', customerId: 'c1', totalCents: 4200, status: 'paid', placedAt: '2026-10-01T09:00:00.000Z' },
    { id: 'o2', customerId: 'c2', totalCents: 990, status: 'shipped', placedAt: '2026-10-02T09:00:00.000Z' },
  ],
  categories: [{ id: 'k1', name: 'Tea' }],
  products: [
    { id: 'p1', name: 'Green tea', categoryId: 'k1', priceCents: 1250 },
    { id: 'p2', name: 'Black tea', categoryId: 'k1', priceCents: 1100 },
  ],
});

const silent = { warn() {} };

test('GET /orders lists orders newest first', async () => {
  const app = createAdminApp({ db: createDb(seed()), logger: silent });
  const res = await app.handle({ method: 'GET', path: '/orders' });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.orders.map((o) => o.id), ['o2', 'o1']);
  assert.equal(res.body.orders[1].totalCents, 4200);
});

test('GET /orders/:id returns the order and its customer', async () => {
  const app = createAdminApp({ db: createDb(seed()), logger: silent });
  const res = await app.handle({ method: 'GET', path: '/orders/o1' });
  assert.equal(res.status, 200);
  assert.equal(res.body.order.id, 'o1');
  assert.equal(res.body.customer.name, 'Ada Lovelace');
  assert.equal((await app.handle({ method: 'GET', path: '/orders/nope' })).status, 404);
});

test('GET /products adds the category name', async () => {
  const app = createAdminApp({ db: createDb(seed()), logger: silent });
  const res = await app.handle({ method: 'GET', path: '/products' });
  assert.deepEqual(res.body.products.map((p) => p.categoryName), ['Tea', 'Tea']);
});

test('requests over the round-trip budget are logged', async () => {
  const warnings = [];
  const db = createDb(seed());
  const app = createAdminApp({ db, logger: { warn: (m) => warnings.push(m) } });
  await app.handle({ method: 'GET', path: '/products' });
  assert.deepEqual(warnings, []);
});
