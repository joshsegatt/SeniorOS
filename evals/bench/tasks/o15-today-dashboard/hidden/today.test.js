import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderStore } from '../../src/orders/store.js';
import { todaySoFar } from '../../src/dashboard/today.js';

test('counts today\'s orders that were not cancelled (default config)', async () => {
  const store = createOrderStore();
  store.add({ placedAt: '2026-10-01T23:59:00Z', totalCents: 800, status: 'placed' });
  store.add({ placedAt: '2026-10-02T00:10:00Z', totalCents: 2500, status: 'placed' });
  store.add({ placedAt: '2026-10-02T08:00:00Z', totalCents: 1000, status: 'shipped' });
  const c = store.add({ placedAt: '2026-10-02T09:00:00Z', totalCents: 9900, status: 'placed' });
  store.setStatus(c.id, 'cancelled');
  assert.deepEqual(await todaySoFar(store, new Date('2026-10-02T10:00:00Z')), { orders: 2, revenueCents: 3500 });
  assert.deepEqual(await todaySoFar(createOrderStore(), new Date('2026-10-02T10:00:00Z')), { orders: 0, revenueCents: 0 });
});
