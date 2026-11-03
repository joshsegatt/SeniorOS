/** @param {string} name */
function nameKey(name) {
  return String(name ?? '').normalize('NFC').trim().toLowerCase();
}

/**
 * Self check-in: the guest types their last name and booking code.
 * @param {ReturnType<import('./store.js').createHotelStore>} store
 * @param {string} lastName
 * @param {string} code
 */
export function findBooking(store, lastName, code) {
  const booking = store.findByCode(code);
  if (!booking) return null;
  return nameKey(booking.guest.lastName) === nameKey(lastName) ? booking : null;
}
