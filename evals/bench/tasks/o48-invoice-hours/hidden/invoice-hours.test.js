import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../../src/db/store.js';
import { migrate } from '../../src/db/migrate.js';
import { migrations } from '../../src/db/migrations/index.js';
import { logTime } from '../../src/time/entries.js';
import { invoiceLines, invoiceTotal } from '../../src/billing/invoice.js';
import { weeklyHours } from '../../src/reports/weekly.js';
import { budgetUsed } from '../../src/projects/budget.js';
import { listEntries } from '../../src/api/entries.js';

const entry = (id, userId, projectId, date, duration, extra = {}) => ({ id, userId, projectId, date, ...duration, note: `note ${id}`, billable: true, createdAt: `${date}T17:00:00.000Z`, ...extra });

/** The production data: entries saved before the minutes release (Oct 14) still have float hours. */
function saved() {
  return createStore({
    meta: { seq: 4200, migrations: ['001-entry-billable'] },
    clients: [{ id: 'cl-14', name: 'Northwind' }],
    projects: [
      { id: 'pr-31', clientId: 'cl-14', name: 'Northwind web shop', hourlyRateCents: 9500, budgetHours: 50 },
      { id: 'pr-32', clientId: 'cl-14', name: 'Northwind support', hourlyRateCents: 7000, budgetHours: 20 },
    ],
    entries: [
      entry('te-4090', 'u-ana', 'pr-31', '2026-09-29', { hours: 8 }),
      entry('te-4101', 'u-ana', 'pr-31', '2026-10-01', { hours: 6.5 }),
      entry('te-4105', 'u-ana', 'pr-32', '2026-10-06', { hours: 1.25 }),
      entry('te-4107', 'u-ben', 'pr-31', '2026-10-07', { hours: 7.5 }),
      entry('te-4112', 'u-ana', 'pr-31', '2026-10-13', { hours: 4.1 }),
      entry('te-4120', 'u-ana', 'pr-31', '2026-10-14', { minutes: 360 }),
      entry('te-4121', 'u-ana', 'pr-32', '2026-10-15', { minutes: 90 }),
      entry('te-4123', 'u-ben', 'pr-31', '2026-10-16', { minutes: 480 }),
      entry('te-4124', 'u-ana', 'pr-31', '2026-10-16', { minutes: 60 }, { billable: false }),
    ],
  });
}

/** What runs on a deploy: the migrations, then the code. */
function deployed() {
  const store = saved();
  migrate(store);
  return store;
}

const minutesOf = (hours) => Math.round(hours * 60);

test('the reported case: the October invoice bills the time saved before the minutes release', () => {
  const store = deployed();
  assert.deepEqual(invoiceLines(store, 'cl-14', '2026-10').map((l) => [l.projectId, l.minutes, l.amountCents]), [
    ['pr-31', 390 + 450 + 246 + 360 + 480, 304950],
    ['pr-32', 75 + 90, 19250],
  ]);
  const total = invoiceTotal(store, 'cl-14', '2026-10');
  assert.equal(total.minutes, 2091);
  assert.equal(total.amountCents, 324200);
});

test('the weekly dashboard counts old entries', () => {
  const store = deployed();
  const mixed = weeklyHours(store, 'u-ana', '2026-10-12');
  assert.equal(minutesOf(mixed.totalHours), 246 + 360 + 90 + 60);
  assert.equal(minutesOf(mixed.billableHours), 246 + 360 + 90);
  const old = weeklyHours(store, 'u-ana', '2026-09-28');
  assert.equal(minutesOf(old.totalHours), 480 + 390);
  assert.equal(old.overtimeHours, 0);
});

test('project budgets count old entries', () => {
  const store = deployed();
  const budget = budgetUsed(store, 'pr-31');
  assert.equal(minutesOf(budget.usedHours), 2466);
  assert.equal(budget.percent, 82);
  assert.equal(budget.alert, true);
  assert.equal(minutesOf(budgetUsed(store, 'pr-32').usedHours), 165);
});

test('the entries API returns integer minutes for old entries too', () => {
  const store = deployed();
  const rows = listEntries(store, { userId: 'u-ana', from: '2026-10-01', to: '2026-10-14' });
  assert.deepEqual(rows.map((r) => [r.id, r.minutes, r.note, r.billable]), [
    ['te-4101', 390, 'note te-4101', true],
    ['te-4105', 75, 'note te-4105', true],
    ['te-4112', 246, 'note te-4112', true],
    ['te-4120', 360, 'note te-4120', true],
  ]);
  for (const r of listEntries(store)) assert.ok(Number.isInteger(r.minutes), `${r.id} minutes ${r.minutes}`);
});

test('every entry the store hands out has integer minutes', () => {
  const store = deployed();
  for (const e of store.all('entries')) assert.ok(Number.isInteger(e.minutes), `${e.id} minutes ${e.minutes}`);
  assert.equal(store.get('entries', 'te-4107').minutes, 450);
});

test('running the migrations again changes nothing', () => {
  const store = deployed();
  const once = store.dump();
  assert.deepEqual(migrate(store), []);
  // A second app server, or a re-run after a deploy that failed halfway: every migration runs again.
  for (const migration of migrations) migration.up(store);
  assert.deepEqual(store.dump(), once);
  assert.deepEqual(invoiceTotal(store, 'cl-14', '2026-10').amountCents, 324200);
});

test('new entries are saved in minutes', () => {
  const store = deployed();
  const created = logTime(store, { userId: 'u-ben', projectId: 'pr-32', date: '2026-10-30', minutes: 45 }, () => new Date('2026-10-30T18:00:00Z'));
  const stored = store.get('entries', created.id);
  assert.equal(stored.minutes, 45);
  assert.equal(stored.hours, undefined);
  assert.equal(invoiceLines(store, 'cl-14', '2026-10').find((l) => l.projectId === 'pr-32').minutes, 165 + 45);
  assert.throws(() => logTime(store, { userId: 'u-ben', projectId: 'pr-32', date: '2026-10-30', minutes: 0.75 }), /minutes/);
});
