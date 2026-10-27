import test from 'node:test';
import assert from 'node:assert/strict';
import { shipDate } from '../../src/shipping.js';

// Production servers run in UTC (README). Node re-reads TZ whenever it changes.
process.env.TZ = 'UTC';

const at = (iso) => new Date(iso);

test('winter (CET, UTC+1): the 14:00 cutoff is Zurich time', () => {
  assert.equal(shipDate(at('2026-01-14T12:59:00Z')), '2026-01-14'); // Wed 13:59 Zurich
  assert.equal(shipDate(at('2026-01-14T13:00:00Z')), '2026-01-15'); // Wed 14:00 Zurich
  assert.equal(shipDate(at('2026-01-14T13:30:00Z')), '2026-01-15'); // Wed 14:30 Zurich
});

test('summer (CEST, UTC+2): the cutoff follows daylight saving time', () => {
  assert.equal(shipDate(at('2026-07-15T11:59:00Z')), '2026-07-15'); // Wed 13:59 Zurich
  assert.equal(shipDate(at('2026-07-15T12:30:00Z')), '2026-07-16'); // Wed 14:30 Zurich
  assert.equal(shipDate(at('2026-03-30T12:30:00Z')), '2026-03-31'); // Mon 14:30 Zurich, the day after the switch
});

test('the calendar day is the Zurich day', () => {
  assert.equal(shipDate(at('2026-07-14T22:30:00Z')), '2026-07-15'); // Wed 00:30 Zurich
  assert.equal(shipDate(at('2026-01-15T23:30:00Z')), '2026-01-16'); // Fri 00:30 Zurich
});

test('no shipping on weekends', () => {
  assert.equal(shipDate(at('2026-07-17T09:00:00Z')), '2026-07-17'); // Fri 11:00 Zurich
  assert.equal(shipDate(at('2026-07-17T13:00:00Z')), '2026-07-20'); // Fri 15:00 Zurich -> Mon
  assert.equal(shipDate(at('2026-07-18T08:00:00Z')), '2026-07-20'); // Sat 10:00 Zurich -> Mon
  assert.equal(shipDate(at('2026-07-19T21:00:00Z')), '2026-07-20'); // Sun 23:00 Zurich -> Mon
  assert.equal(shipDate(at('2026-09-30T13:00:00Z')), '2026-10-01'); // Wed 15:00 Zurich -> Thu, next month
});
