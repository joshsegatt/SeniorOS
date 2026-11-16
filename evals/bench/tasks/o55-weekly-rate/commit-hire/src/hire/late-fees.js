import { daysBetween } from './dates.js';

/** Days after the agreed return day: a machine brought back on its return day is not late. */
export function lateDays(returnDay, returnedOn) {
  return Math.max(0, daysBetween(returnDay, returnedOn));
}

/** Each late day costs one and a half daily rates, rounded to the centime. */
export function lateFeeCents(item, returnDay, returnedOn) {
  return Math.round(lateDays(returnDay, returnedOn) * item.dailyRateCents * 1.5);
}
