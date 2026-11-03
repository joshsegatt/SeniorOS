export class SlotTaken extends Error {
  constructor(start, end, other) {
    super(`${start}–${end} overlaps booking ${other.id}`);
    this.name = 'SlotTaken';
    this.bookingId = other.id;
  }
}

export class BookingNotFound extends Error {
  constructor(id) {
    super(`booking ${id} not found`);
    this.name = 'BookingNotFound';
  }
}

const toMs = (iso) => {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new RangeError(`not a date: ${iso}`);
  return ms;
};

const view = (b) => ({ id: b.id, name: b.name, start: new Date(b.start).toISOString(), end: new Date(b.end).toISOString() });

/** The recording studio's calendar: one room, bookings never overlap. */
export function createCalendar() {
  const bookings = [];
  let seq = 0;

  /** Index of the first booking that starts at or after `ms`. */
  function insertionIndex(ms) {
    let lo = 0;
    let hi = bookings.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (bookings[mid].start < ms) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  /** The booking that overlaps [start, end), if any. */
  function clash(start, end) {
    let lo = 0;
    let hi = bookings.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (bookings[mid].end <= start) lo = mid + 1;
      else hi = mid;
    }
    const next = bookings[lo];
    return next && next.start < end ? next : null;
  }

  function span({ start, end }) {
    const s = toMs(start);
    const e = toMs(end);
    if (e <= s) throw new RangeError('a booking must end after it starts');
    return [s, e];
  }

  return {
    book({ name, start, end }) {
      const [s, e] = span({ start, end });
      const other = clash(s, e);
      if (other) throw new SlotTaken(start, end, view(other));
      const booking = { id: `b${++seq}`, name, start: s, end: e };
      bookings.splice(insertionIndex(s), 0, booking);
      return view(booking);
    },

    get(id) {
      const booking = bookings.find((b) => b.id === id);
      if (!booking) throw new BookingNotFound(id);
      return view(booking);
    },

    cancel(id) {
      const i = bookings.findIndex((b) => b.id === id);
      if (i === -1) throw new BookingNotFound(id);
      bookings.splice(i, 1);
    },

    isFree(start, end) {
      const [s, e] = span({ start, end });
      return clash(s, e) === null;
    },

    /** Bookings that start in [from, to), in time order. */
    agenda(from, to) {
      const f = toMs(from);
      const t = toMs(to);
      const out = [];
      for (let i = insertionIndex(f); i < bookings.length && bookings[i].start < t; i++) out.push(view(bookings[i]));
      return out;
    },
  };
}
