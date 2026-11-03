import test from 'node:test';
import assert from 'node:assert/strict';
import { createTaskStore } from '../../src/tasks/store.js';
import { createTask } from '../../src/tasks/tasks.js';
import { taskFromEmail } from '../../src/tasks/email-intake.js';
import { dueOn, overdue } from '../../src/tasks/agenda.js';
import { calendarFeed } from '../../src/tasks/calendar.js';

const lena = { id: 'u-lena', name: 'Lena', timeZone: 'Europe/Berlin' };
const omar = { id: 'u-omar', name: 'Omar', timeZone: 'America/New_York' };

function lenaWithEmailTask() {
  const store = createTaskStore();
  taskFromEmail(store, lena, { subject: 'Fwd: Send Q3 invoice to Hartmann', body: 'Hi Lena,\nplease handle this.\ndue: 14 Oct\n', receivedAt: '2026-10-12T08:31:40Z' });
  return store;
}

test('the reported case: a task from a forwarded email shows up on its due day', () => {
  assert.deepEqual(dueOn(lenaWithEmailTask(), lena, '2026-10-14').map((t) => t.title), ['Send Q3 invoice to Hartmann']);
  assert.deepEqual(dueOn(lenaWithEmailTask(), lena, '2026-10-13'), []);
});

test('the reminder email does not call an emailed task overdue on its due day', () => {
  const store = lenaWithEmailTask();
  assert.deepEqual(overdue(store, lena, '2026-10-14'), []);
  assert.deepEqual(overdue(store, lena, '2026-10-15').map((t) => t.title), ['Send Q3 invoice to Hartmann']);
});

test('the calendar feed puts an emailed task on its due day', () => {
  const store = lenaWithEmailTask();
  const ics = calendarFeed(store.forOwner(lena.id));
  assert.match(ics, /\r\nDUE;VALUE=DATE:20261014\r\n/);
});

test('emailed tasks west of UTC land on the right day too', () => {
  const store = createTaskStore();
  // 19:30 on Oct 14 in New York.
  taskFromEmail(store, omar, { subject: 'Quote for Lisbon office', body: 'due: tomorrow', receivedAt: '2026-10-14T23:30:00Z' });
  assert.deepEqual(dueOn(store, omar, '2026-10-15').map((t) => t.title), ['Quote for Lisbon office']);
  assert.deepEqual(overdue(store, omar, '2026-10-15'), []);
  assert.match(calendarFeed(store.forOwner(omar.id)), /DUE;VALUE=DATE:20261015\r\n/);
});

test('emailed and app tasks sort together in the overdue list', () => {
  const store = lenaWithEmailTask();
  createTask(store, lena, { title: 'Renew parking permit', dueDate: '2026-10-13' });
  createTask(store, lena, { title: 'Water plants', dueDate: '2026-10-14' });
  assert.deepEqual(overdue(store, lena, '2026-10-16').map((t) => t.title), ['Renew parking permit', 'Send Q3 invoice to Hartmann', 'Water plants']);
});

test('app tasks and emails without a due line keep working', () => {
  const store = createTaskStore();
  createTask(store, lena, { title: 'Pay rent', dueDate: '2026-10-14' });
  taskFromEmail(store, lena, { subject: 'Re: lunch', body: 'no rush', receivedAt: '2026-10-12T08:00:00Z' });
  assert.deepEqual(dueOn(store, lena, '2026-10-14').map((t) => t.title), ['Pay rent']);
  assert.equal(store.forOwner(lena.id).find((t) => t.title === 'lunch')?.dueDate, null);
});
