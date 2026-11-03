import test from 'node:test';
import assert from 'node:assert/strict';
import { createCalendar, SlotTaken } from '../../src/studio/calendar.js';
import { createStudioApi } from '../../src/studio/api.js';

const at = (hhmm, day = '2026-11-10') => `${day}T${hhmm}:00.000Z`;

function week() {
  const cal = createCalendar();
  const a = cal.book({ name: 'A', start: at('09:00'), end: at('10:00') });
  const b = cal.book({ name: 'B', start: at('11:00'), end: at('12:00') });
  const c = cal.book({ name: 'C', start: at('13:00'), end: at('14:00') });
  const d = cal.book({ name: 'D', start: at('09:00', '2026-11-12'), end: at('10:00', '2026-11-12') });
  return { cal, a, b, c, d };
}

test('a booking moves and keeps its id', () => {
  const { cal, a } = week();
  const moved = cal.reschedule(a.id, { start: at('15:00'), end: at('16:00') });
  assert.equal(moved.id, a.id);
  assert.equal(moved.start, at('15:00'));
  assert.equal(cal.get(a.id).end, at('16:00'));
});

test('after a move the old slot is free and the new one is taken', () => {
  const { cal, a } = week();
  cal.reschedule(a.id, { start: at('15:00'), end: at('16:00') });
  assert.equal(cal.isFree(at('09:00'), at('10:00')), true);
  assert.equal(cal.isFree(at('15:30'), at('15:45')), false);
  assert.equal(cal.isFree(at('14:30'), at('15:10')), false);
  assert.throws(() => cal.book({ name: 'E', start: at('15:15'), end: at('15:45') }), SlotTaken);
  assert.equal(cal.book({ name: 'E', start: at('09:00'), end: at('10:00') }).name, 'E');
});

test('the agenda stays in time order after moves', () => {
  const { cal, a, d } = week();
  cal.reschedule(a.id, { start: at('16:00'), end: at('17:00') });
  cal.reschedule(d.id, { start: at('07:00'), end: at('08:00') });
  assert.deepEqual(cal.agenda(at('00:00'), at('23:59')).map((x) => x.name), ['D', 'B', 'C', 'A']);
  assert.deepEqual(cal.agenda(at('12:30'), at('23:59')).map((x) => x.name), ['C', 'A']);
  assert.deepEqual(cal.agenda(at('00:00', '2026-11-12'), at('23:59', '2026-11-12')), []);
});

test('moving onto another booking is refused and nothing changes', () => {
  const { cal, a } = week();
  assert.throws(() => cal.reschedule(a.id, { start: at('11:30'), end: at('12:30') }), SlotTaken);
  assert.equal(cal.get(a.id).start, at('09:00'));
  assert.equal(cal.isFree(at('09:00'), at('10:00')), false);
});

test('a move that overlaps both its own slot and the next booking is refused', () => {
  const { cal, a } = week();
  assert.throws(() => cal.reschedule(a.id, { start: at('09:30'), end: at('11:30') }), SlotTaken);
  assert.equal(cal.get(a.id).end, at('10:00'));
});

test('a booking can be shifted over its own time', () => {
  const { cal, b } = week();
  const moved = cal.reschedule(b.id, { start: at('11:30'), end: at('12:30') });
  assert.equal(moved.start, at('11:30'));
  assert.equal(cal.isFree(at('11:00'), at('11:30')), true);
  assert.equal(cal.isFree(at('12:00'), at('12:30')), false);
});

test('several moves in a row keep availability right', () => {
  const { cal, a, b, c } = week();
  cal.reschedule(c.id, { start: at('06:00'), end: at('07:00') });
  cal.reschedule(a.id, { start: at('18:00'), end: at('19:00') });
  cal.reschedule(b.id, { start: at('13:00'), end: at('14:00') });
  for (const [s, e, free] of [['06:30', '06:45', false], ['09:00', '10:00', true], ['11:00', '12:00', true], ['13:30', '13:45', false], ['18:30', '18:45', false], ['15:00', '17:00', true]]) {
    assert.equal(cal.isFree(at(s), at(e)), free, `${s}-${e}`);
  }
});

test('the booking page can move a booking', () => {
  const { cal, a } = week();
  const api = createStudioApi(cal);
  assert.equal(api.rescheduleBooking(a.id, { start: at('15:00'), end: at('16:00') }).status, 200);
  assert.equal(api.rescheduleBooking(a.id, { start: at('11:00'), end: at('11:30') }).status, 409);
  assert.equal(api.rescheduleBooking('nope', { start: at('20:00'), end: at('21:00') }).status, 404);
  assert.deepEqual(api.day('2026-11-10').body.map((x) => x.name), ['B', 'C', 'A']);
});
