import test from 'node:test';
import assert from 'node:assert/strict';
import { openStore } from '../src/appointments/store.js';
import { bookAppointment, cancelAppointment, rescheduleAppointment } from '../src/appointments/booking.js';
import { dayAgenda } from '../src/web/agenda.js';
import { dueReminders } from '../src/jobs/reminders.js';

function clinic() {
  return openStore({
    practitioners: [{ id: 'p-1', name: 'Dr. Lena Keller' }],
    patients: [
      { id: 'pt-1', name: 'Ana Costa', phone: '+41791110001' },
      { id: 'pt-2', name: 'Ben Huber', phone: '+41791110002' },
    ],
  });
}

test('the agenda lists the booked appointments of the day in order', () => {
  const store = clinic();
  bookAppointment(store, { practitionerId: 'p-1', patientId: 'pt-2', date: '2026-09-03', time: '11:00' });
  const ana = bookAppointment(store, { practitionerId: 'p-1', patientId: 'pt-1', date: '2026-09-03', time: '08:30', durationMin: 45 });
  assert.equal(ana.id, 'a-502');
  assert.deepEqual(dayAgenda(store, 'p-1', '2026-09-03').appointments.map((a) => `${a.time} ${a.patient}`), ['08:30 Ana Costa', '11:00 Ben Huber']);
  cancelAppointment(store, ana.id);
  assert.equal(dayAgenda(store, 'p-1', '2026-09-03').appointments.length, 1);
});

test('an overlapping slot is refused', () => {
  const store = clinic();
  bookAppointment(store, { practitionerId: 'p-1', patientId: 'pt-1', date: '2026-09-03', time: '08:30', durationMin: 45 });
  assert.throws(() => bookAppointment(store, { practitionerId: 'p-1', patientId: 'pt-2', date: '2026-09-03', time: '09:00' }), /slot taken/);
  const ben = bookAppointment(store, { practitionerId: 'p-1', patientId: 'pt-2', date: '2026-09-03', time: '09:15' });
  assert.equal(rescheduleAppointment(store, ben.id, { date: '2026-09-04', time: '09:00' }).date, '2026-09-04');
});

test('reminders go out the day before', () => {
  const store = clinic();
  bookAppointment(store, { practitionerId: 'p-1', patientId: 'pt-1', date: '2026-09-03', time: '08:30' });
  assert.deepEqual(dueReminders(store, new Date('2026-09-02T07:00:00Z')).map((r) => r.text), ['Reminder: Dr. Lena Keller on 2026-09-03 at 08:30. Reply C to cancel.']);
  assert.equal(dueReminders(store, new Date('2026-09-01T05:00:00Z')).length, 0);
});
