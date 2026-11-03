import { SlotTaken, BookingNotFound } from './calendar.js';

/** JSON handlers for the booking page. */
export function createStudioApi(calendar) {
  const fail = (err) => {
    if (err instanceof SlotTaken) return { status: 409, body: { error: 'slot_taken', bookingId: err.bookingId } };
    if (err instanceof BookingNotFound) return { status: 404, body: { error: 'not_found' } };
    if (err instanceof RangeError) return { status: 400, body: { error: 'invalid', message: err.message } };
    throw err;
  };
  const attempt = (fn) => {
    try {
      return fn();
    } catch (err) {
      return fail(err);
    }
  };

  return {
    createBooking: (body) => attempt(() => ({ status: 201, body: calendar.book(body) })),
    cancelBooking: (id) => attempt(() => (calendar.cancel(id), { status: 204 })),
    rescheduleBooking: (id, body) => attempt(() => ({ status: 200, body: calendar.reschedule(id, body) })),
    availability: ({ start, end }) => attempt(() => ({ status: 200, body: { free: calendar.isFree(start, end) } })),
    day: (date) => attempt(() => ({ status: 200, body: calendar.agenda(`${date}T00:00:00Z`, `${date}T24:00:00Z`) })),
  };
}
