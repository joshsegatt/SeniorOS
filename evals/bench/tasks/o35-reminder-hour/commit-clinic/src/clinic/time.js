import { CLINIC } from './config.js';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const parts = new Intl.DateTimeFormat('en-US', {
  timeZone: CLINIC.timeZone,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

/**
 * An instant as seen on the clinic's wall clock.
 * @param {Date} instant
 * @returns {{ date: string, time: string, weekday: string, day: number, month: string }}
 */
export function clinicClock(instant) {
  const p = Object.fromEntries(parts.formatToParts(instant).map((x) => [x.type, x.value]));
  const date = `${p.year}-${p.month}-${p.day}`;
  const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
  return { date, time: `${p.hour}:${p.minute}`, weekday, day: Number(p.day), month: MONTHS[Number(p.month) - 1] };
}

/**
 * A date and time on the clinic's wall clock as a UTC ISO timestamp (how startsAt is stored).
 * @param {string} date YYYY-MM-DD
 * @param {string} time HH:MM
 */
export function fromClinicTime(date, time) {
  const asUtc = Date.parse(`${date}T${time}:00Z`);
  if (Number.isNaN(asUtc)) throw new Error(`invalid date/time ${date} ${time}`);
  const p = Object.fromEntries(parts.formatToParts(new Date(asUtc)).map((x) => [x.type, x.value]));
  const shown = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return new Date(asUtc - (shown - asUtc)).toISOString();
}

/** Throws unless time is a bookable slot within opening hours. @param {string} time HH:MM */
export function assertSlot(time) {
  if (!/^\d{2}:\d{2}$/.test(time)) throw new Error(`invalid time ${time}`);
  const minutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const m = minutes(time);
  if (m < minutes(CLINIC.opensAt) || m + CLINIC.slotMinutes > minutes(CLINIC.closesAt)) throw new Error(`${time} is outside opening hours`);
  if (m % CLINIC.slotMinutes !== 0) throw new Error(`${time} is not a slot start`);
}
