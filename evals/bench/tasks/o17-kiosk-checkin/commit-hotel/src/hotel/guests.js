/**
 * Guest profiles: one per person (same last name and email), counting their stays.
 * @param {ReturnType<import('./store.js').createHotelStore>} store
 * @param {{ firstName: string, lastName: string, email: string }} guest
 * @returns {string} the guest id
 */
export function upsertGuest(store, guest) {
  const key = profileKey(guest.lastName, guest.email);
  const existing = store.guests().find((g) => profileKey(g.lastName, g.email) === key);
  if (existing) {
    store.updateGuest(existing.id, { stays: existing.stays + 1 });
    return existing.id;
  }
  const id = store.nextId('g');
  store.insertGuest({ id, firstName: guest.firstName, lastName: guest.lastName, email: String(guest.email ?? '').trim().toLowerCase(), stays: 1 });
  return id;
}

/** @param {string} lastName @param {string} email */
function profileKey(lastName, email) {
  return `${lastName.toLowerCase()}|${String(email ?? '').trim().toLowerCase()}`;
}

/**
 * Front desk search: part of the first or last name, sorted by last name.
 * @param {ReturnType<import('./store.js').createHotelStore>} store
 * @param {string} query
 */
export function searchGuests(store, query) {
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) return [];
  return store
    .guests()
    .filter((g) => `${g.firstName} ${g.lastName}`.toLowerCase().includes(q))
    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'de'));
}
