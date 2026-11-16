import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/db/store.js';
import { migrate } from '../src/db/migrate.js';
import { logTime } from '../src/time/entries.js';
import { invoiceLines, invoiceTotal } from '../src/billing/invoice.js';
import { weeklyHours } from '../src/reports/weekly.js';
import { budgetUsed } from '../src/projects/budget.js';
import { listEntries } from '../src/api/entries.js';

const at = () => new Date('2026-09-30T18:00:00Z');

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
  const entry = logTime(store, { userId: 'u-1', projectId: 'pr-1', date: '2026-09-21', hours: 2.5 }, at);
  assert.equal(entry.hours, 2.5);
  assert.equal(entry.billable, true);
  assert.throws(() => logTime(store, { userId: 'u-1', projectId: 'pr-9', date: '2026-09-21', hours: 1 }), /unknown project/);
  assert.throws(() => logTime(store, { userId: 'u-1', projectId: 'pr-1', date: '21/09/2026', hours: 1 }), /date/);
  assert.throws(() => logTime(store, { userId: 'u-1', projectId: 'pr-1', date: '2026-09-21', hours: 0 }), /hours/);
});

test('the invoice bills billable time at each project rate', () => {
  const store = agency();
  logTime(store, { userId: 'u-1', projectId: 'pr-1', date: '2026-09-21', hours: 2.5 }, at);
  logTime(store, { userId: 'u-2', projectId: 'pr-2', date: '2026-09-22', hours: 1 }, at);
  logTime(store, { userId: 'u-2', projectId: 'pr-2', date: '2026-09-22', hours: 3, billable: false }, at);
  logTime(store, { userId: 'u-1', projectId: 'pr-1', date: '2026-08-31', hours: 4 }, at);
  assert.deepEqual(invoiceLines(store, 'cl-1', '2026-09'), [
    { projectId: 'pr-1', name: 'Acme site', hours: 2.5, amountCents: 22500 },
    { projectId: 'pr-2', name: 'Acme support', hours: 1, amountCents: 6000 },
  ]);
  assert.deepEqual(invoiceTotal(store, 'cl-1', '2026-09'), { hours: 3.5, amountCents: 28500 });
});

test('weekly hours, budgets and the entries API', () => {
  const store = agency();
  logTime(store, { userId: 'u-1', projectId: 'pr-1', date: '2026-09-21', hours: 8 }, at);
  logTime(store, { userId: 'u-1', projectId: 'pr-2', date: '2026-09-22', hours: 8.5, billable: false }, at);
  logTime(store, { userId: 'u-1', projectId: 'pr-1', date: '2026-09-28', hours: 8 }, at);
  assert.deepEqual(weeklyHours(store, 'u-1', '2026-09-21'), { userId: 'u-1', weekStart: '2026-09-21', totalHours: 16.5, billableHours: 8, overtimeHours: 0 });
  assert.deepEqual(budgetUsed(store, 'pr-1'), { projectId: 'pr-1', usedHours: 16, budgetHours: 20, percent: 80, alert: true });
  assert.deepEqual(listEntries(store, { userId: 'u-1', to: '2026-09-27' }).map((e) => [e.date, e.hours]), [['2026-09-21', 8], ['2026-09-22', 8.5]]);
});

test('migrations run once and mark old entries billable', () => {
  const store = createStore({ entries: [{ id: 'te-1', userId: 'u-1', projectId: 'pr-1', date: '2026-01-05', hours: 1 }] });
  assert.deepEqual(migrate(store), ['001-entry-billable']);
  assert.equal(store.get('entries', 'te-1').billable, true);
  assert.deepEqual(migrate(store), []);
});
