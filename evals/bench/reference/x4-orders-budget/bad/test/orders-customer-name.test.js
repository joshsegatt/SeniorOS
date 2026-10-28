import test from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from '../src/admin/db.js';
import { createAdminApp } from '../src/admin/app.js';

test('GET /orders adds the customer name', async () => {
  const db = createDb({
    customers: [{ id: 'c1', name: 'Ada', email: 'a@x' }, { id: 'c2', name: 'Bob', email: 'b@x' }],
    orders: [
      { id: 'o1', customerId: 'c1', totalCents: 1, status: 'paid', placedAt: '2026-10-01T00:00:00.000Z' },
      { id: 'o2', customerId: 'c2', totalCents: 2, status: 'paid', placedAt: '2026-10-02T00:00:00.000Z' },
    ],
  });
  const app = createAdminApp({ db, logger: { warn() {} } });
  const res = await app.handle({ method: 'GET', path: '/orders' });
  assert.deepEqual(res.body.orders.map((o) => o.customerName), ['Bob', 'Ada']);
});
