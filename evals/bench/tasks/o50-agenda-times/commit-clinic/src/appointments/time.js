/** The clinic's wall clock. Staff and patients type and read local times. */
export const CLINIC_TZ = 'Europe/Zurich';

const partsFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: CLINIC_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Date and time on the clinic's wall clock. @param {Date} instant @returns {{ date: string, time: string }} */
export function localParts(instant) {
  const p = Object.fromEntries(partsFormat.formatToParts(instant).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** Minutes the clinic's clock is ahead of UTC at an instant. @param {number} ms */
function offsetAt(ms) {
  const { date, time } = localParts(new Date(ms));
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return Date.UTC(y, m - 1, d, h, min) - Math.floor(ms / 60_000) * 60_000;
}

/** The instant of a date and time on the clinic's wall clock. @param {string} date "2026-11-19" @param {string} time "09:30" */
export function zonedToUtc(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || !/^\d{2}:\d{2}$/.test(String(time))) {
    throw new Error(`bad local time: ${date} ${time}`);
  }
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, h, min);
  // Twice: the first guess can sit on the other side of a daylight saving change.
  const guess = wall - offsetAt(wall);
  return new Date(wall - offsetAt(guess));
}
