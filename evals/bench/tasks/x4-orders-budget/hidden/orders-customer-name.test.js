import test from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../../src/admin/db.js';
import { createAdminApp } from '../../src/admin/app.js';

const silent = { warn() {} };

function bigSeed() {
  const customers = Array.from({ length: 15 }, (_, i) => ({ id: `c${i + 1}`, name: `Customer ${i + 1}`, email: `c${i + 1}@example.com` }));
  const orders = Array.from({ length: 40 }, (_, i) => ({
    id: `o${String(i + 1).padStart(2, '0')}`,
    customerId: `c${(i % 15) + 1}`,
    totalCents: 1000 + i,
    status: i % 3 === 0 ? 'shipped' : 'paid',
    placedAt: new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString(),
  }));
  return { customers, orders };
}

test('every order in GET /orders carries its customer name', async () => {
  const seed = bigSeed();
  const app = createAdminApp({ db: createDb(seed), logger: silent });
  const res = await app.handle({ method: 'GET', path: '/orders' });
  assert.equal(res.status, 200);
  assert.equal(res.body.orders.length, 40);
  const nameOf = new Map(seed.customers.map((c) => [c.id, c.name]));
  for (const order of res.body.orders) {
    assert.equal(order.customerName, nameOf.get(order.customerId), `order ${order.id}`);
  }
});

test('orders keep their fields and their newest-first order', async () => {
  const seed = bigSeed();
  const app = createAdminApp({ db: createDb(seed), logger: silent });
  const res = await app.handle({ method: 'GET', path: '/orders' });
  assert.equal(res.body.orders[0].id, 'o40');
  assert.equal(res.body.orders[39].id, 'o01');
  assert.equal(res.body.orders[0].totalCents, 1039);
  assert.equal(res.body.orders[39].status, 'shipped');
});

test('GET /orders stays within the round-trip budget whatever the number of orders', async () => {
  const db = createDb(bigSeed());
  const warnings = [];
  const app = createAdminApp({ db, logger: { warn: (m) => warnings.push(m) } });
  const before = db.stats.roundTrips;
  await app.handle({ method: 'GET', path: '/orders' });
  const used = db.stats.roundTrips - before;
  assert.ok(used <= 3, `GET /orders made ${used} round trips for 40 orders (budget 3)`);
  assert.deepEqual(warnings, []);
});

test('no orders', async () => {
  const app = createAdminApp({ db: createDb({ customers: [], orders: [] }), logger: silent });
  const res = await app.handle({ method: 'GET', path: '/orders' });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.orders, []);
});
