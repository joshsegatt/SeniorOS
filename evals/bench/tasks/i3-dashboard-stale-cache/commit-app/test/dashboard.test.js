import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDashboardApp } from '../src/http.js';
import { fakeClock } from './helpers/fake-clock.js';

test('auto-refresh reads are served from the cache', () => {
  const clock = fakeClock('2026-11-27T10:00:00Z');
  const app = createDashboardApp({ clock });
  app.sales.recordSale({ storeId: 's1', amountCents: 4000, orderId: 'o1' });
  app.dashboard.dailySummary('s1');
  clock.advance(30_000);
  app.dashboard.dailySummary('s1');
  assert.equal(app.ledger.scanCount, 1);
});

test('a sale shows up immediately', () => {
  const clock = fakeClock('2026-11-27T10:00:00Z');
  const app = createDashboardApp({ clock });
  assert.equal(app.dashboard.dailySummary('s1').salesCents, 0);
  app.sales.recordSale({ storeId: 's1', amountCents: 4000, orderId: 'o1' });
  assert.equal(app.dashboard.dailySummary('s1').salesCents, 4000);
});

test('a POS import shows up immediately', () => {
  const clock = fakeClock('2026-11-27T10:00:00Z');
  const app = createDashboardApp({ clock });
  assert.equal(app.dashboard.dailySummary('s1').salesCents, 0);
  app.sales.importBatch([
    { storeId: 's1', day: '2026-11-27', type: 'sale', amountCents: 700 },
    { storeId: 's1', day: '2026-11-27', type: 'sale', amountCents: 300 },
  ]);
  assert.equal(app.dashboard.dailySummary('s1').salesCents, 1000);
});

test('http routes', () => {
  const app = createDashboardApp({ clock: fakeClock('2026-11-27T10:00:00Z') });
  assert.equal(app.handle({ method: 'GET', path: '/dashboard', query: {} }).status, 400);
  assert.equal(app.handle({ method: 'POST', path: '/sales', body: { storeId: 's1', amountCents: 500 } }).status, 201);
  const res = app.handle({ method: 'GET', path: '/dashboard', query: { store: 's1' } });
  assert.equal(res.status, 200);
  assert.equal(res.body.salesCents, 500);
  assert.equal(app.handle({ method: 'GET', path: '/nope' }).status, 404);
});
