import { parseDay } from './dates.js';

/**
 * Whether `itemId` is free from `pickupDay` to `returnDay`. A booking holds the machine on its pickup day and on its
 * return day (see docs/adr/0002-calendar-day-hire.md), so a hire returned on the 11th blocks a pickup on the 11th.
 * @param {{ itemId: string, pickupDay: string, returnDay: string, status: string }[]} bookings
 */
export function isAvailable(bookings, itemId, pickupDay, returnDay) {
  parseDay(pickupDay);
  parseDay(returnDay);
  if (returnDay < pickupDay) throw new Error('return day is before pickup day');
  return !bookings.some((b) => b.itemId === itemId && b.status !== 'cancelled' && b.pickupDay <= returnDay && pickupDay <= b.returnDay);
}

/** The first day from `fromDay` on when the item is back in the yard and can go out again. */
export function nextFreeDay(bookings, itemId, fromDay) {
  let day = fromDay;
  for (const b of [...bookings].filter((x) => x.itemId === itemId && x.status !== 'cancelled').sort((x, y) => (x.pickupDay < y.pickupDay ? -1 : 1))) {
    if (b.pickupDay <= day && day <= b.returnDay) day = nextDay(b.returnDay);
  }
  return day;
}

function nextDay(day) {
  const d = parseDay(day);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
