import { upsertGuest } from './guests.js';
import { cleanName } from './names.js';

/**
 * Imports the reservations pulled from the channel manager. Known confirmation codes and cancelled
 * reservations are skipped, so the sync can run on the same feed again.
 * @param {ReturnType<import('./store.js').createHotelStore>} store
 * @param {{ reservations: { confirmation: string, channel: string, status: string, arrival: string, departure: string, guest: { given_name: string, family_name: string, email: string } }[] }} feed
 */
export function syncChannelReservations(store, feed) {
  const result = { added: 0, skipped: 0 };
  for (const r of feed.reservations) {
    const code = String(r.confirmation).trim().toUpperCase();
    if (r.status === 'cancelled' || store.findByCode(code)) {
      result.skipped += 1;
      continue;
    }
    // The channel manager sends names decomposed (NFD); store them like direct bookings do.
    const guest = { firstName: cleanName(r.guest.given_name), lastName: cleanName(r.guest.family_name) };
    const guestId = upsertGuest(store, { ...guest, email: r.guest.email });
    store.insertBooking({ id: store.nextId('b'), code, guestId, guest, arrival: r.arrival, departure: r.departure, source: r.channel });
    result.added += 1;
  }
  return result;
}
