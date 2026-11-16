// Billing days are calendar days in UTC, written YYYY-MM-DD. Periods run from periodStart (included) to periodEnd
// (excluded): a period that starts on 20 January ends on 20 February, when the next one starts.
export const DAY_MS = 86_400_000;

/** @param {string} day YYYY-MM-DD */
export function parseDay(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`invalid billing day: ${day}`);
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || formatDay(date) !== day) throw new Error(`invalid billing day: ${day}`);
  return date;
}

/** @param {Date} date */
export function formatDay(date) {
  return date.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (0 for the same day). */
export function daysBetween(from, to) {
  return Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / DAY_MS);
}

/** 1 for 1 January, 365 (366 in a leap year) for 31 December. */
export function dayOfYear(day) {
  const d = parseDay(day);
  return Math.round((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / DAY_MS) + 1;
}

/** The same day of the month, `n` months later (31 January + 1 month = 28 or 29 February). */
export function addMonths(day, n) {
  const d = parseDay(day);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), lastDay));
  return formatDay(target);
}
