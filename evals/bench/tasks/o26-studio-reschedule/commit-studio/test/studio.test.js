import test from 'node:test';
import assert from 'node:assert/strict';
import { createCalendar, SlotTaken } from '../src/studio/calendar.js';
import { createStudioApi } from '../src/studio/api.js';

const at = (hhmm, day = '2026-11-10') => `${day}T${hhmm}:00.000Z`;

test('bookings that overlap are refused', () => {
  const cal = createCalendar();
  cal.book({ name: 'Ana', start: at('10:00'), end: at('12:00') });
  assert.throws(() => cal.book({ name: 'Bo', start: at('11:00'), end: at('13:00') }), SlotTaken);
  assert.throws(() => cal.book({ name: 'Bo', start: at('09:00'), end: at('10:30') }), SlotTaken);
  assert.equal(cal.book({ name: 'Bo', start: at('12:00'), end: at('13:00') }).name, 'Bo');
});

test('availability and the day agenda', () => {
  const cal = createCalendar();
  cal.book({ name: 'C', start: at('15:00'), end: at('16:00') });
  cal.book({ name: 'A', start: at('09:00'), end: at('10:00') });
  cal.book({ name: 'B', start: at('11:00'), end: at('12:00') });
  cal.book({ name: 'D', start: at('09:00', '2026-11-11'), end: at('10:00', '2026-11-11') });
  assert.equal(cal.isFree(at('10:00'), at('11:00')), true);
  assert.equal(cal.isFree(at('11:30'), at('12:30')), false);
  assert.deepEqual(cal.agenda(at('00:00'), at('23:59')).map((b) => b.name), ['A', 'B', 'C']);
});

test('cancelled bookings free their slot', () => {
  const cal = createCalendar();
  const b = cal.book({ name: 'A', start: at('09:00'), end: at('10:00') });
  cal.cancel(b.id);
  assert.equal(cal.isFree(at('09:00'), at('10:00')), true);
});

test('the api maps calendar errors to statuses', () => {
  const api = createStudioApi(createCalendar());
  assert.equal(api.createBooking({ name: 'A', start: at('09:00'), end: at('10:00') }).status, 201);
  assert.equal(api.createBooking({ name: 'B', start: at('09:30'), end: at('10:30') }).status, 409);
  assert.equal(api.createBooking({ name: 'B', start: at('11:00'), end: at('10:30') }).status, 400);
  assert.equal(api.cancelBooking('nope').status, 404);
  assert.deepEqual(api.day('2026-11-10').body.map((b) => b.name), ['A']);
});
