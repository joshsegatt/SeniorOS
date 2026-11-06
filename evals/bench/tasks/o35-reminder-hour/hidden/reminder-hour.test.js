import test from 'node:test';
import assert from 'node:assert/strict';
import { createClinicStore } from '../../src/clinic/store.js';
import { bookAtReception, registerPatient } from '../../src/clinic/appointments.js';
import { dueReminders, reminderText } from '../../src/clinic/reminders.js';
import { daySchedule } from '../../src/clinic/schedule.js';
import { markNoShows } from '../../src/clinic/no-shows.js';
import { bookOnline } from '../../src/web/booking-widget.js';

// Production servers run in UTC; pin it so the result does not depend on this machine's zone.
process.env.TZ = 'UTC';

function okafor() {
  const store = createClinicStore();
  const a = bookOnline(store, { name: 'Grace Okafor', phone: '+27 72 555 0118', doctor: 'Dr. Naidoo', date: '2026-11-12', time: '09:30' });
  return { store, a, patient: /** @type {any} */ (store.patient(a.patientId)) };
}

test('the reported case: the SMS for an online booking says 09:30', () => {
  const { a, patient } = okafor();
  const text = reminderText(a, patient);
  assert.match(text, /Thu 12 Nov at 09:30/);
  assert.doesNotMatch(text, /11:30/);
});

test('the reminder for an online booking goes out the day before, like the others', () => {
  const { store, a } = okafor();
  assert.deepEqual(dueReminders(store, new Date('2026-11-11T06:00:00Z')), []);
  assert.deepEqual(dueReminders(store, new Date('2026-11-11T08:00:00Z')).map((r) => r.appointmentId), [a.id]);
});

test('the reception screen shows an online booking at its time', () => {
  const { store } = okafor();
  const thandi = registerPatient(store, { name: 'Thandi Mokoena', phone: '+27 82 555 0101' });
  bookAtReception(store, { patientId: thandi.id, doctor: 'Dr. Naidoo', date: '2026-11-12', time: '10:00' });
  assert.deepEqual(daySchedule(store, '2026-11-12').map((r) => [r.time, r.patient]), [['09:30', 'Grace Okafor'], ['10:00', 'Thandi Mokoena']]);
});

test('an online booking is marked as a no-show 15 minutes after its time, not later', () => {
  const { store, a } = okafor();
  assert.deepEqual(markNoShows(store, new Date('2026-11-12T07:40:00Z')), []);
  assert.deepEqual(markNoShows(store, new Date('2026-11-12T07:50:00Z')), [a.id]);
});

test('reception cannot double-book a slot taken online, and the reverse', () => {
  const { store } = okafor();
  const thandi = registerPatient(store, { name: 'Thandi Mokoena', phone: '+27 82 555 0101' });
  assert.throws(() => bookAtReception(store, { patientId: thandi.id, doctor: 'Dr. Naidoo', date: '2026-11-12', time: '09:30' }), /taken/);
  bookAtReception(store, { patientId: thandi.id, doctor: 'Dr. Naidoo', date: '2026-11-12', time: '11:30' });
  assert.throws(() => bookOnline(store, { name: 'Sam Lee', phone: '+27 72 555 0100', doctor: 'Dr. Naidoo', date: '2026-11-12', time: '11:30' }), /taken/);
});

test('reception bookings are unchanged', () => {
  const store = createClinicStore();
  const thandi = registerPatient(store, { name: 'Thandi Mokoena', phone: '+27 82 555 0101' });
  const a = bookAtReception(store, { patientId: thandi.id, doctor: 'Dr. Naidoo', date: '2026-11-12', time: '09:30' });
  assert.match(reminderText(a, thandi), /Thu 12 Nov at 09:30/);
  assert.deepEqual(daySchedule(store, '2026-11-12').map((r) => r.time), ['09:30']);
});
