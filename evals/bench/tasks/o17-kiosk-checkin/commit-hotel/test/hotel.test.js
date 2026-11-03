import test from 'node:test';
import assert from 'node:assert/strict';
import { createHotelStore } from '../src/hotel/store.js';
import { createBooking } from '../src/hotel/bookings.js';
import { syncChannelReservations } from '../src/hotel/channel-sync.js';
import { searchGuests } from '../src/hotel/guests.js';
import { findBooking } from '../src/hotel/kiosk.js';

const stay = { arrival: '2026-10-14', departure: '2026-10-16' };

test('a direct booking can check in at the kiosk', () => {
  const store = createHotelStore();
  createBooking(store, { firstName: ' Jörg ', lastName: 'Weiß', email: 'jw@example.de', code: 'ab3cd', ...stay });
  assert.equal(findBooking(store, 'weiß', 'AB3CD')?.guest.firstName, 'Jörg');
  assert.equal(findBooking(store, 'Weiss', 'AB3CD'), null);
  assert.equal(findBooking(store, 'Weiß', 'ZZZZZ'), null);
});

test('repeat direct guests keep one profile', () => {
  const store = createHotelStore();
  createBooking(store, { firstName: 'Ana', lastName: 'Lopes', email: 'ana@example.pt', ...stay });
  createBooking(store, { firstName: 'Ana', lastName: 'LOPES', email: 'Ana@Example.pt', arrival: '2026-11-01', departure: '2026-11-03' });
  assert.equal(store.guests().length, 1);
  assert.equal(store.guests()[0].stays, 2);
});

test('channel sync adds new reservations once and skips cancelled ones', () => {
  const store = createHotelStore();
  const feed = {
    reservations: [
      { confirmation: 'q7rt2', channel: 'booking.com', status: 'confirmed', ...stay, guest: { given_name: 'Tom', family_name: 'Baker', email: 'tom@example.com' } },
      { confirmation: 'X9P3M', channel: 'expedia', status: 'cancelled', ...stay, guest: { given_name: 'Ivy', family_name: 'Chen', email: 'ivy@example.com' } },
    ],
  };
  assert.deepEqual(syncChannelReservations(store, feed), { added: 1, skipped: 1 });
  assert.deepEqual(syncChannelReservations(store, feed), { added: 0, skipped: 2 });
  assert.equal(findBooking(store, 'Baker', 'Q7RT2')?.source, 'booking.com');
});

test('front desk search by part of the name', () => {
  const store = createHotelStore();
  createBooking(store, { firstName: 'Zoë', lastName: 'Adams', email: 'zoe@example.com', ...stay });
  createBooking(store, { firstName: 'Ben', lastName: 'Zola', email: 'ben@example.com', ...stay });
  assert.deepEqual(searchGuests(store, 'zo').map((g) => g.lastName), ['Adams', 'Zola']);
  assert.deepEqual(searchGuests(store, ' '), []);
});
