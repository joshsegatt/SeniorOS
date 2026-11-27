import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDashboardApp } from '../../src/http.js';
import { createLedger } from '../../src/ledger.js';

function clockAt(iso) {
  let now = Date.parse(iso);
  return { now: () => now, advance: (ms) => { now += ms; } };
}

test('right after midnight the dashboard shows the new day, not yesterday', () => {
  const ledger = createLedger();
  ledger.append({ storeId: 's1', day: '2026-11-26', type: 'sale', amountCents: 5000 });
  ledger.append({ storeId: 's1', day: '2026-11-27', type: 'sale', amountCents: 1200 });
  const clock = clockAt('2026-11-26T23:59:50Z');
  const app = createDashboardApp({ clock, ledger });

  const before = app.dashboard.dailySummary('s1');
  assert.equal(before.day, '2026-11-26');
  assert.equal(before.salesCents, 5000);

  clock.advance(20_000); // 2026-11-27T00:00:10Z
  const after = app.dashboard.dailySummary('s1');
  assert.equal(after.day, '2026-11-27');
  assert.equal(after.salesCents, 1200);
});

test('an explicit day is never answered with another day', () => {
  const ledger = createLedger();
  ledger.append({ storeId: 's1', day: '2026-11-26', type: 'sale', amountCents: 5000 });
  ledger.append({ storeId: 's1', day: '2026-11-27', type: 'sale', amountCents: 1200 });
  const app = createDashboardApp({ clock: clockAt('2026-11-27T12:00:00Z'), ledger });
  assert.equal(app.dashboard.dailySummary('s1', '2026-11-26').salesCents, 5000);
  assert.equal(app.dashboard.dailySummary('s1', '2026-11-27').salesCents, 1200);
  assert.equal(app.dashboard.dailySummary('s1', '2026-11-26').salesCents, 5000);
});

test('a sale is visible immediately', () => {
  const clock = clockAt('2026-11-27T10:00:00Z');
  const app = createDashboardApp({ clock });
  app.dashboard.dailySummary('s1');
  clock.advance(5_000);
  app.sales.recordSale({ storeId: 's1', amountCents: 4000, orderId: 'o1' });
  assert.equal(app.dashboard.dailySummary('s1').salesCents, 4000);
});

test('a refund is visible immediately', () => {
  const clock = clockAt('2026-11-27T10:00:00Z');
  const app = createDashboardApp({ clock });
  app.sales.recordSale({ storeId: 's1', amountCents: 4000, orderId: 'o1' });
  assert.equal(app.dashboard.dailySummary('s1').netCents, 4000);
  clock.advance(5_000);
  app.sales.recordRefund({ storeId: 's1', amountCents: 1500, orderId: 'o1' });
  const summary = app.dashboard.dailySummary('s1');
  assert.equal(summary.refundsCents, 1500);
  assert.equal(summary.netCents, 2500);
});

test('a refund through the HTTP route is visible on the next GET', () => {
  const clock = clockAt('2026-11-27T10:00:00Z');
  const app = createDashboardApp({ clock });
  app.handle({ method: 'POST', path: '/sales', body: { storeId: 's2', amountCents: 9000, orderId: 'o9' } });
  assert.equal(app.handle({ method: 'GET', path: '/dashboard', query: { store: 's2' } }).body.netCents, 9000);
  clock.advance(1_000);
  app.handle({ method: 'POST', path: '/refunds', body: { storeId: 's2', amountCents: 9000, orderId: 'o9' } });
  assert.equal(app.handle({ method: 'GET', path: '/dashboard', query: { store: 's2' } }).body.netCents, 0);
});

test('a POS import for an earlier day refreshes that day', () => {
  const clock = clockAt('2026-11-27T10:00:00Z');
  const app = createDashboardApp({ clock });
  assert.equal(app.dashboard.dailySummary('s1', '2026-11-25').salesCents, 0);
  app.sales.importBatch([{ storeId: 's1', day: '2026-11-25', type: 'sale', amountCents: 800 }]);
  assert.equal(app.dashboard.dailySummary('s1', '2026-11-25').salesCents, 800);
});

test('without writes, a summary is aggregated once even across 10 minutes of auto-refresh', () => {
  const clock = clockAt('2026-11-27T10:00:00Z');
  const app = createDashboardApp({ clock });
  app.sales.recordSale({ storeId: 's1', amountCents: 4000, orderId: 'o1' });
  const scansBefore = app.ledger.scanCount;
  for (let i = 0; i < 20; i += 1) {
    app.dashboard.dailySummary('s1');
    clock.advance(30_000);
  }
  assert.equal(app.ledger.scanCount - scansBefore, 1);
});
