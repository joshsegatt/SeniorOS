// Calendar days are 'YYYY-MM-DD' strings. Users see their tasks in their own time zone.

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** @param {unknown} value */
export function isDay(value) {
  return typeof value === 'string' && DAY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/** @param {string} day @param {number} n */
export function addDays(day, n) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday ... 6 = Saturday. @param {string} day */
export function weekday(day) {
  return new Date(`${day}T00:00:00Z`).getUTCDay();
}

/**
 * The calendar day of an instant in a time zone.
 * @param {Date | string | number} instant
 * @param {string} timeZone IANA name, e.g. 'Europe/Berlin'
 */
export function dayInZone(instant, timeZone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instant));
}

/** Minutes the zone is ahead of UTC at `instant`. @param {Date} instant @param {string} timeZone */
function offsetMinutes(instant, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000);
}

/**
 * Midnight at the start of `day` in `timeZone`.
 * @param {string} day
 * @param {string} timeZone
 */
export function startOfDayInZone(day, timeZone) {
  const utcMidnight = new Date(`${day}T00:00:00Z`);
  const first = offsetMinutes(utcMidnight, timeZone);
  const guess = new Date(utcMidnight.getTime() - first * 60000);
  const second = offsetMinutes(guess, timeZone);
  return second === first ? guess : new Date(utcMidnight.getTime() - second * 60000);
}
