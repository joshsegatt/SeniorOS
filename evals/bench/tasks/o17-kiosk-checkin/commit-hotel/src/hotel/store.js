/**
 * In-memory hotel store (the production adapter has the same interface).
 * @typedef {{ id: string, code: string, guestId: string, guest: { firstName: string, lastName: string }, arrival: string, departure: string, source: string }} Booking
 * @typedef {{ id: string, firstName: string, lastName: string, email: string, stays: number }} Guest
 */
export function createHotelStore() {
  /** @type {Booking[]} */
  const bookings = [];
  /** @type {Guest[]} */
  const guests = [];
  let seq = 0;

  return {
    /** @param {string} prefix */
    nextId(prefix) {
      seq += 1;
      return `${prefix}${seq}`;
    },
    /** @param {Booking} booking */
    insertBooking(booking) {
      bookings.push(structuredClone(booking));
      return structuredClone(booking);
    },
    /** @param {string} code */
    findByCode(code) {
      const key = String(code ?? '').trim().toUpperCase();
      const found = bookings.find((b) => b.code === key);
      return found ? structuredClone(found) : null;
    },
    bookings() {
      return bookings.map((b) => structuredClone(b));
    },
    /** @param {Guest} guest */
    insertGuest(guest) {
      guests.push({ ...guest });
      return { ...guest };
    },
    /** @param {string} id @param {Partial<Guest>} patch */
    updateGuest(id, patch) {
      const found = guests.find((g) => g.id === id);
      if (!found) throw new Error(`unknown guest ${id}`);
      Object.assign(found, patch);
      return { ...found };
    },
    guests() {
      return guests.map((g) => ({ ...g }));
    },
  };
}
