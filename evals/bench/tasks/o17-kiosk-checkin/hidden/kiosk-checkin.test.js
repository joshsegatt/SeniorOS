import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHotelStore } from '../../src/hotel/store.js';
import { createBooking } from '../../src/hotel/bookings.js';
import { syncChannelReservations } from '../../src/hotel/channel-sync.js';
import { searchGuests } from '../../src/hotel/guests.js';
import { findBooking } from '../../src/hotel/kiosk.js';

// What a guest types on a keyboard (composed characters).
const typed = (s) => s.normalize('NFC');
const feed = () => JSON.parse(readFileSync(new URL('../../data/channel-feed-2026-10-14.json', import.meta.url), 'utf8'));

function syncedStore() {
  const store = createHotelStore();
  syncChannelReservations(store, feed());
  return store;
}

test('the reported case: Müller checks in at the kiosk with code KX4Q2', () => {
  const store = syncedStore();
  assert.equal(findBooking(store, typed('Müller'), 'KX4Q2')?.code, 'KX4Q2');
  assert.equal(findBooking(store, typed('müller'), 'kx4q2')?.code, 'KX4Q2');
  assert.equal(findBooking(store, typed('García'), 'P5ZLA')?.code, 'P5ZLA');
});

test('the front desk finds channel guests by the name as they type it', () => {
  const store = syncedStore();
  assert.deepEqual(searchGuests(store, typed('Müller')).map((g) => g.email), ['anna.mueller@example.de']);
  assert.deepEqual(searchGuests(store, typed('zoë')).map((g) => g.email), ['zoe.o@example.no']);
  assert.deepEqual(searchGuests(store, typed('Hélène Lef')).map((g) => g.email), ['helene.lefevre@example.fr']);
});

test('a guest who booked through a channel and then directly keeps one profile', () => {
  const store = syncedStore();
  createBooking(store, { firstName: 'Anna', lastName: typed('Müller'), email: 'anna.mueller@example.de', arrival: '2026-12-01', departure: '2026-12-03' });
  const profiles = store.guests().filter((g) => g.email === 'anna.mueller@example.de');
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].stays, 2);
});

test('a guest who booked directly and then through a channel keeps one profile', () => {
  const store = createHotelStore();
  createBooking(store, { firstName: typed('José'), lastName: typed('García'), email: 'jgarcia@example.es', arrival: '2026-09-01', departure: '2026-09-03' });
  syncChannelReservations(store, feed());
  const profiles = store.guests().filter((g) => g.email === 'jgarcia@example.es');
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].stays, 2);
});

test('the sync stays idempotent and direct bookings still work', () => {
  const store = syncedStore();
  assert.deepEqual(syncChannelReservations(store, feed()), { added: 0, skipped: 7 });
  createBooking(store, { firstName: 'Lea', lastName: typed('Größer'), email: 'lea@example.de', code: 'LG234', arrival: '2026-10-20', departure: '2026-10-21' });
  assert.equal(findBooking(store, typed('größer'), 'LG234')?.guest.firstName, 'Lea');
  assert.equal(findBooking(store, 'Baker', 'Q7RT2')?.source, 'booking.com');
});
