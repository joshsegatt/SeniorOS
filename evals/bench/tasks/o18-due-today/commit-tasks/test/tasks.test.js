import test from 'node:test';
import assert from 'node:assert/strict';
import { createTaskStore } from '../src/tasks/store.js';
import { completeTask, createTask } from '../src/tasks/tasks.js';
import { taskFromEmail } from '../src/tasks/email-intake.js';
import { dueOn, overdue, todayFor } from '../src/tasks/agenda.js';
import { calendarFeed } from '../src/tasks/calendar.js';
import { dayInZone, startOfDayInZone } from '../src/tasks/days.js';

const lena = { id: 'u-lena', name: 'Lena', timeZone: 'Europe/Berlin' };
const now = () => new Date('2026-10-12T08:00:00Z');

test('days in a time zone', () => {
  assert.equal(dayInZone('2026-10-13T22:30:00Z', 'Europe/Berlin'), '2026-10-14');
  assert.equal(dayInZone('2026-10-14T03:00:00Z', 'America/New_York'), '2026-10-13');
  assert.equal(startOfDayInZone('2026-10-14', 'Europe/Berlin').toISOString(), '2026-10-13T22:00:00.000Z');
  assert.equal(todayFor(lena, new Date('2026-10-13T22:30:00Z')), '2026-10-14');
});

test('due today lists open tasks due that day', () => {
  const store = createTaskStore();
  createTask(store, lena, { title: 'Pay rent', dueDate: '2026-10-14' }, now);
  createTask(store, lena, { title: 'Call Ben', dueDate: '2026-10-14' }, now);
  const done = createTask(store, lena, { title: 'Book train', dueDate: '2026-10-14' }, now);
  createTask(store, lena, { title: 'Later', dueDate: '2026-10-20' }, now);
  completeTask(store, done.id);
  assert.deepEqual(dueOn(store, lena, '2026-10-14').map((t) => t.title), ['Call Ben', 'Pay rent']);
});

test('overdue tasks', () => {
  const store = createTaskStore();
  createTask(store, lena, { title: 'Old', dueDate: '2026-10-10' }, now);
  createTask(store, lena, { title: 'Today', dueDate: '2026-10-14' }, now);
  createTask(store, lena, { title: 'No date' }, now);
  assert.deepEqual(overdue(store, lena, '2026-10-14').map((t) => t.title), ['Old']);
});

test('tasks are created from forwarded emails', () => {
  const store = createTaskStore();
  const t = taskFromEmail(store, lena, { subject: 'Fwd: Contract draft', body: 'Please review.\n', receivedAt: '2026-10-12T09:00:00Z' });
  assert.equal(t.title, 'Contract draft');
  assert.equal(t.dueDate, null);
  assert.equal(t.source, 'email');
});

test('calendar feed', () => {
  const store = createTaskStore();
  createTask(store, lena, { title: 'Pay rent, now', dueDate: '2026-10-14' }, now);
  const ics = calendarFeed(store.forOwner(lena.id));
  assert.match(ics, /SUMMARY:Pay rent\\, now\r\nDUE;VALUE=DATE:20261014\r\n/);
});

test('createTask rejects a bad due date', () => {
  assert.throws(() => createTask(createTaskStore(), lena, { title: 'x', dueDate: '14.10.2026' }, now), /dueDate/);
});
