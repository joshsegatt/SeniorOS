import test from 'node:test';
import assert from 'node:assert/strict';
import { openStore } from '../../src/appointments/store.js';
import { bookAppointment, rescheduleAppointment } from '../../src/appointments/booking.js';
import { dayAgenda } from '../../src/web/agenda.js';
import { dueReminders } from '../../src/jobs/reminders.js';
import { icsFeed } from '../../src/calendar/ics.js';
import { upcomingFor } from '../../src/portal/patients.js';

/** Production as it is: appointments booked before the release keep a local date and time, later ones a UTC startsAt. */
function production() {
  const old = (id, practitionerId, patientId, date, time, durationMin, extra = {}) => ({ id, practitionerId, patientId, date, time, durationMin, channel: 'phone', status: 'booked', remindedAt: null, ...extra });
  const now = (id, practitionerId, patientId, startsAt, durationMin) => ({ id, practitionerId, patientId, startsAt, durationMin, channel: 'online', status: 'booked', remindedAt: null });
  return {
    migrations: ['001-appointment-channel'],
    practitioners: [{ id: 'p-1', name: 'Dr. Lena Keller' }, { id: 'p-2', name: 'Marc Dubois' }],
    patients: [
      { id: 'pt-1', name: 'Ana Costa', phone: '+41795551001' },
      { id: 'pt-2', name: 'Ben Huber', phone: '+41795551002' },
      { id: 'pt-3', name: 'Chiara Rossi', phone: '+41795551003' },
      { id: 'pt-4', name: 'Dora Imhof', phone: '+41795551004' },
    ],
    appointments: [
      old('a-701', 'p-1', 'pt-1', '2026-11-19', '08:00', 45),
      old('a-702', 'p-1', 'pt-2', '2026-11-19', '10:30', 60),
      old('a-703', 'p-2', 'pt-3', '2027-04-01', '10:00', 30),
      old('a-704', 'p-1', 'pt-3', '2026-11-19', '15:00', 30, { status: 'cancelled' }),
      old('a-705', 'p-1', 'pt-4', '2026-11-18', '18:00', 30, { remindedAt: '2026-11-17T17:10:00.000Z' }),
      now('a-801', 'p-1', 'pt-3', '2026-11-19T08:15:00.000Z', 30),
      now('a-802', 'p-1', 'pt-4', '2026-11-19T13:00:00.000Z', 45),
    ],
  };
}

const agendaLines = (store, practitionerId, date) => dayAgenda(store, practitionerId, date).appointments.map((a) => `${a.time} ${a.patient}`);
const thursday = ['08:00 Ana Costa', '09:15 Chiara Rossi', '10:30 Ben Huber', '14:00 Dora Imhof'];

test('the reported case: the day agenda shows older and newer appointments together', () => {
  const store = openStore(production());
  assert.deepEqual(agendaLines(store, 'p-1', '2026-11-19'), thursday);
  assert.deepEqual(agendaLines(store, 'p-1', '2026-11-18'), ['18:00 Dora Imhof']);
});

test('reminders go out for appointments booked before the release too', () => {
  const store = openStore(production());
  const texts = dueReminders(store, new Date('2026-11-18T09:00:00Z')).map((r) => r.text).sort();
  assert.deepEqual(texts, [
    'Reminder: Dr. Lena Keller on 2026-11-19 at 08:00. Reply C to cancel.',
    'Reminder: Dr. Lena Keller on 2026-11-19 at 09:15. Reply C to cancel.',
  ]);
});

test('the calendar feed has every appointment at its UTC time, across daylight saving time', () => {
  const store = openStore(production());
  const keller = icsFeed(store, 'p-1');
  assert.match(keller, /UID:a-701@clinic\r\nDTSTART:20261119T070000Z\r\nDTEND:20261119T074500Z/);
  assert.match(keller, /UID:a-702@clinic\r\nDTSTART:20261119T093000Z\r\nDTEND:20261119T103000Z/);
  assert.match(keller, /UID:a-801@clinic\r\nDTSTART:20261119T081500Z/);
  assert.doesNotMatch(keller, /a-704/);
  assert.match(icsFeed(store, 'p-2'), /UID:a-703@clinic\r\nDTSTART:20270401T080000Z\r\nDTEND:20270401T083000Z/);
});

test('an older appointment still blocks its slot', () => {
  const store = openStore(production());
  assert.throws(() => bookAppointment(store, { practitionerId: 'p-1', patientId: 'pt-4', date: '2026-11-19', time: '08:30' }), /slot taken/);
  assert.throws(() => bookAppointment(store, { practitionerId: 'p-2', patientId: 'pt-1', date: '2027-04-01', time: '10:15' }), /slot taken/);
  assert.equal(bookAppointment(store, { practitionerId: 'p-1', patientId: 'pt-4', date: '2026-11-19', time: '08:45' }).status, 'booked');
});

test('the patient portal lists older appointments', () => {
  const store = openStore(production());
  assert.deepEqual(upcomingFor(store, 'pt-3', new Date('2026-11-18T09:00:00Z')), [
    { id: 'a-801', practitioner: 'Dr. Lena Keller', date: '2026-11-19', time: '09:15', durationMin: 30 },
    { id: 'a-703', practitioner: 'Marc Dubois', date: '2027-04-01', time: '10:00', durationMin: 30 },
  ]);
});

test('new bookings keep storing only the UTC instant', () => {
  const store = openStore(production());
  const booked = bookAppointment(store, { practitionerId: 'p-1', patientId: 'pt-1', date: '2026-11-20', time: '08:30' });
  assert.equal(store.appointment(booked.id).startsAt, '2026-11-20T07:30:00.000Z');
  const row = store.dump().appointments.find((a) => a.id === booked.id);
  assert.equal(row.startsAt, '2026-11-20T07:30:00.000Z');
  assert.ok(!('date' in row) && !('time' in row), `stored row has local fields: ${JSON.stringify(row)}`);
});

test('rescheduling an older appointment moves it, also after the database is opened again', () => {
  const store = openStore(production());
  rescheduleAppointment(store, 'a-702', { date: '2026-11-20', time: '11:00' });
  assert.deepEqual(agendaLines(store, 'p-1', '2026-11-20'), ['11:00 Ben Huber']);
  assert.ok(!agendaLines(store, 'p-1', '2026-11-19').includes('10:30 Ben Huber'));
  assert.equal(bookAppointment(store, { practitionerId: 'p-1', patientId: 'pt-1', date: '2026-11-19', time: '10:30' }).status, 'booked');
  const reopened = openStore(store.dump());
  assert.deepEqual(agendaLines(reopened, 'p-1', '2026-11-20'), ['11:00 Ben Huber']);
  assert.equal(reopened.appointment('a-702').startsAt, '2026-11-20T10:00:00.000Z');
});

test('opening the database again, or a fresh copy, changes nothing', () => {
  const twice = openStore(openStore(production()).dump());
  assert.deepEqual(agendaLines(twice, 'p-1', '2026-11-19'), thursday);
  assert.equal(twice.appointment('a-801').startsAt, '2026-11-19T08:15:00.000Z');
  const fresh = openStore({ ...production(), migrations: [] });
  assert.deepEqual(agendaLines(fresh, 'p-1', '2026-11-19'), thursday);
  assert.equal(fresh.appointment('a-703').channel, 'phone');
});
