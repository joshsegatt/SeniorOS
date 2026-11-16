import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/db/store.js';
import { migrate } from '../src/db/migrate.js';
import { logTime } from '../src/time/entries.js';
import { invoiceLines, invoiceTotal } from '../src/billing/invoice.js';
import { weeklyHours } from '../src/reports/weekly.js';
import { budgetUsed } from '../src/projects/budget.js';
import { listEntries } from '../src/api/entries.js';

const at = () => new Date('2026-10-30T18:00:00Z');

function agency() {
  return createStore({
    clients: [{ id: 'cl-1', name: 'Acme' }],
    projects: [
      { id: 'pr-1', clientId: 'cl-1', name: 'Acme site', hourlyRateCents: 9000, budgetHours: 20 },
      { id: 'pr-2', clientId: 'cl-1', name: 'Acme support', hourlyRateCents: 6000, budgetHours: 10 },
    ],
  });
}

test('logging time validates the input', () => {
  const store = agency();
  const entry = logTime(store, { userId: 'u-1', projectId: 'pr-1', date: '2026-10-21', minutes: 150 }, at);
  assert.equal(entry.minutes, 150);
  assert.equal(entry.billable, true);
  assert.throws(() => logTime(store, { userId: 'u-1', projectId: 'pr-9', date: '2026-10-21', minutes: 60 }), /unknown project/);
  assert.throws(() => logTime(store, { userId: 'u-1', projectId: 'pr-1', date: '21/10/2026', minutes: 60 }), /date/);
  assert.throws(() => logTime(store, { userId: 'u-1', projectId: 'pr-1', date: '2026-10-21', minutes: 0 }), /minutes/);
  assert.throws(() => logTime(store, { userId: 'u-1', projectId: 'pr-1', date: '2026-10-21', minutes: 1.5 }), /minutes/);
});

test('the invoice bills billable time at each project rate', () => {
  const store = agency();
  logTime(store, { userId: 'u-1', projectId: 'pr-1', date: '2026-10-21', minutes: 150 }, at);
  logTime(store, { userId: 'u-2', projectId: 'pr-2', date: '2026-10-22', minutes: 60 }, at);
  logTime(store, { userId: 'u-2', projectId: 'pr-2', date: '2026-10-22', minutes: 180, billable: false }, at);
  logTime(store, { userId: 'u-1', projectId: 'pr-1', date: '2026-11-02', minutes: 240 }, at);
  assert.deepEqual(invoiceLines(store, 'cl-1', '2026-10'), [
    { projectId: 'pr-1', name: 'Acme site', minutes: 150, hours: 2.5, amountCents: 22500 },
    { projectId: 'pr-2', name: 'Acme support', minutes: 60, hours: 1, amountCents: 6000 },
  ]);
  assert.deepEqual(invoiceTotal(store, 'cl-1', '2026-10'), { minutes: 210, hours: 3.5, amountCents: 28500 });
});

test('weekly hours, budgets and the entries API', () => {
  const store = agency();
  logTime(store, { userId: 'u-1', projectId: 'pr-1', date: '2026-10-19', minutes: 480 }, at);
  logTime(store, { userId: 'u-1', projectId: 'pr-2', date: '2026-10-20', minutes: 510, billable: false }, at);
  logTime(store, { userId: 'u-1', projectId: 'pr-1', date: '2026-10-26', minutes: 480 }, at);
  assert.deepEqual(weeklyHours(store, 'u-1', '2026-10-19'), { userId: 'u-1', weekStart: '2026-10-19', totalHours: 16.5, billableHours: 8, overtimeHours: 0 });
  assert.deepEqual(budgetUsed(store, 'pr-1'), { projectId: 'pr-1', usedHours: 16, budgetHours: 20, percent: 80, alert: true });
  assert.deepEqual(listEntries(store, { userId: 'u-1', to: '2026-10-25' }).map((e) => [e.date, e.minutes]), [['2026-10-19', 480], ['2026-10-20', 510]]);
});

test('migrations run once and mark old entries billable', () => {
  const store = createStore({ entries: [{ id: 'te-1', userId: 'u-1', projectId: 'pr-1', date: '2026-01-05', minutes: 60 }] });
  assert.ok(migrate(store).includes('001-entry-billable'));
  assert.equal(store.get('entries', 'te-1').billable, true);
  assert.deepEqual(migrate(store), []);
});
