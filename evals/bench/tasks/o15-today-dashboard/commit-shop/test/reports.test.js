import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../src/config.js';
import { createOrderStore } from '../src/orders/store.js';
import { dailySales } from '../src/reports/daily.js';
import { shopDay } from '../src/lib/dates.js';

test('config: defaults overlaid with the environment file', () => {
  assert.equal(config.shop.name, 'Kiosk Ceramics');
  assert.equal(config.logLevel, 'debug');
  assert.equal(config.dashboard.refreshSeconds, 60);
});

test('shopDay formats the calendar day', () => {
  assert.equal(shopDay(new Date('2026-03-09T10:00:00Z')), '2026-03-09');
});

test('daily sales leave out cancelled orders', () => {
  const store = createOrderStore();
  store.add({ placedAt: '2026-10-01T08:00:00Z', totalCents: 2500, status: 'placed' });
  store.add({ placedAt: '2026-10-01T09:00:00Z', totalCents: 1000, status: 'shipped' });
  const c = store.add({ placedAt: '2026-10-01T10:00:00Z', totalCents: 9900, status: 'placed' });
  store.add({ placedAt: '2026-10-02T08:00:00Z', totalCents: 700, status: 'placed' });
  store.setStatus(c.id, 'cancelled');
  assert.deepEqual(dailySales(store, '2026-10-01'), { day: '2026-10-01', orders: 2, revenueCents: 3500 });
});
