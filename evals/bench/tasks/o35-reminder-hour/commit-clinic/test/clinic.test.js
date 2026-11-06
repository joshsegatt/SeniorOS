import test from 'node:test';
import assert from 'node:assert/strict';
import { createClinicStore } from '../src/clinic/store.js';
import { bookAtReception, cancel, checkIn, registerPatient } from '../src/clinic/appointments.js';
import { syncDoctorCalendar } from '../src/clinic/calendar-sync.js';
import { dueReminders, reminderText } from '../src/clinic/reminders.js';
import { daySchedule } from '../src/clinic/schedule.js';
import { markNoShows } from '../src/clinic/no-shows.js';
import { bookOnline } from '../src/web/booking-widget.js';

function clinic() {
  const store = createClinicStore();
  const thandi = registerPatient(store, { name: 'Thandi Mokoena', phone: '+27 82 555 0101' });
  const pieter = registerPatient(store, { name: 'Pieter van Wyk', phone: '+27 83 555 0177' });
  return { store, thandi, pieter };
}

test('a reception booking is stored in UTC and shown in clinic time', () => {
  const { store, thandi } = clinic();
  const a = bookAtReception(store, { patientId: thandi.id, doctor: 'Dr. Naidoo', date: '2026-11-12', time: '09:30' });
  assert.equal(a.startsAt, '2026-11-12T07:30:00.000Z');
  assert.equal(reminderText(a, thandi), 'Hi Thandi, a reminder of your appointment with Dr. Naidoo on Thu 12 Nov at 09:30. To cancel, call +27 11 555 0142.');
  assert.deepEqual(daySchedule(store, '2026-11-12').map((r) => [r.time, r.patient]), [['09:30', 'Thandi Mokoena']]);
});

test('reminders go out the day before', () => {
  const { store, thandi } = clinic();
  const a = bookAtReception(store, { patientId: thandi.id, doctor: 'Dr. Naidoo', date: '2026-11-12', time: '09:30' });
  assert.deepEqual(dueReminders(store, new Date('2026-11-11T06:00:00Z')), []);
  const due = dueReminders(store, new Date('2026-11-11T08:00:00Z'));
  assert.deepEqual(due.map((r) => [r.appointmentId, r.to]), [[a.id, '+27825550101']]);
  cancel(store, a.id);
  assert.deepEqual(dueReminders(store, new Date('2026-11-11T08:00:00Z')), []);
});

test('the day schedule is in order and per doctor', () => {
  const { store, thandi, pieter } = clinic();
  bookAtReception(store, { patientId: pieter.id, doctor: 'Dr. Naidoo', date: '2026-11-12', time: '14:00' });
  bookAtReception(store, { patientId: thandi.id, doctor: 'Dr. Botha', date: '2026-11-12', time: '08:00' });
  bookAtReception(store, { patientId: thandi.id, doctor: 'Dr. Naidoo', date: '2026-11-13', time: '08:00' });
  assert.deepEqual(daySchedule(store, '2026-11-12').map((r) => [r.time, r.doctor]), [['08:00', 'Dr. Botha'], ['14:00', 'Dr. Naidoo']]);
  assert.deepEqual(daySchedule(store, '2026-11-12', 'Dr. Naidoo').map((r) => r.patient), ['Pieter van Wyk']);
});

test('patients who do not check in are marked as no-shows after 15 minutes', () => {
  const { store, thandi, pieter } = clinic();
  const a = bookAtReception(store, { patientId: thandi.id, doctor: 'Dr. Naidoo', date: '2026-11-12', time: '09:30' });
  const b = bookAtReception(store, { patientId: pieter.id, doctor: 'Dr. Naidoo', date: '2026-11-12', time: '10:00' });
  checkIn(store, b.id);
  assert.deepEqual(markNoShows(store, new Date('2026-11-12T07:40:00Z')), []);
  assert.deepEqual(markNoShows(store, new Date('2026-11-12T08:30:00Z')), [a.id]);
  assert.equal(store.appointment(a.id)?.status, 'no-show');
});

test('a slot cannot be booked twice', () => {
  const { store, thandi, pieter } = clinic();
  bookAtReception(store, { patientId: thandi.id, doctor: 'Dr. Naidoo', date: '2026-11-12', time: '09:30' });
  assert.throws(() => bookAtReception(store, { patientId: pieter.id, doctor: 'Dr. Naidoo', date: '2026-11-12', time: '09:30' }), /taken/);
  assert.throws(() => bookAtReception(store, { patientId: pieter.id, doctor: 'Dr. Naidoo', date: '2026-11-12', time: '17:00' }), /opening hours/);
  bookAtReception(store, { patientId: pieter.id, doctor: 'Dr. Botha', date: '2026-11-12', time: '09:30' });
});

test('the calendar sync imports doctors\' own appointments once', () => {
  const { store, thandi } = clinic();
  const page = {
    items: [
      { id: 'evt-1', status: 'confirmed', start: { dateTime: '2026-11-12T11:00:00+02:00' }, extendedProperties: { private: { patientId: thandi.id } } },
      { id: 'evt-2', status: 'cancelled', start: { dateTime: '2026-11-12T12:00:00+02:00' }, extendedProperties: { private: { patientId: thandi.id } } },
      { id: 'evt-3', status: 'confirmed', start: { dateTime: '2026-11-12T13:00:00+02:00' } },
    ],
  };
  assert.deepEqual(syncDoctorCalendar(store, 'Dr. Naidoo', page), { added: 1, skipped: 2 });
  assert.deepEqual(syncDoctorCalendar(store, 'Dr. Naidoo', page), { added: 0, skipped: 3 });
  assert.deepEqual(daySchedule(store, '2026-11-12').map((r) => [r.time, r.patient]), [['11:00', 'Thandi Mokoena']]);
});

test('online booking registers the patient and takes the slot', () => {
  const store = createClinicStore();
  const a = bookOnline(store, { name: 'Lerato Dlamini', phone: '+27 72 555 0199', doctor: 'Dr. Botha', date: '2026-11-13', time: '10:00' });
  assert.equal(a.source, 'online');
  assert.equal(store.patient(a.patientId)?.phone, '+27725550199');
  assert.throws(() => bookOnline(store, { name: 'Sam', phone: '+27 72 555 0100', doctor: 'Dr. Botha', date: '2026-11-13', time: '10:00' }), /taken/);
  assert.throws(() => bookOnline(store, { name: 'Sam', phone: '+27 72 555 0100', doctor: 'Dr. Botha', date: '2026-11-13', time: '10:15' }), /slot/);
});
