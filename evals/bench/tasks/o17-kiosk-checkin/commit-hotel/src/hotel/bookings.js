import { upsertGuest } from './guests.js';
import { cleanName } from './names.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * A direct booking (website or front desk).
 * @param {ReturnType<import('./store.js').createHotelStore>} store
 * @param {{ firstName: string, lastName: string, email: string, arrival: string, departure: string, code?: string }} input
 */
export function createBooking(store, input) {
  const firstName = cleanName(input.firstName);
  const lastName = cleanName(input.lastName);
  if (!lastName) throw new Error('last name is required');
  if (!DAY.test(input.arrival) || !DAY.test(input.departure) || input.departure <= input.arrival) throw new Error('invalid dates');
  const code = input.code ? String(input.code).trim().toUpperCase() : newCode(store);
  if (store.findByCode(code)) throw new Error(`booking code ${code} is taken`);
  const guestId = upsertGuest(store, { firstName, lastName, email: input.email });
  return store.insertBooking({ id: store.nextId('b'), code, guestId, guest: { firstName, lastName }, arrival: input.arrival, departure: input.departure, source: 'direct' });
}

/** @param {ReturnType<import('./store.js').createHotelStore>} store */
function newCode(store) {
  for (;;) {
    let code = '';
    for (let i = 0; i < 5; i += 1) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    if (!store.findByCode(code)) return code;
  }
}
