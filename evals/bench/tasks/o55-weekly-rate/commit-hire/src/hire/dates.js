const DAY_MS = 86_400_000;

/** @param {string} day YYYY-MM-DD */
export function parseDay(day) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`invalid day: ${day}`);
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day) throw new Error(`invalid day: ${day}`);
  return date;
}

/** Days from `from` to `to`: 0 for the same day, 1 from Monday to Tuesday. */
export function daysBetween(from, to) {
  return Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / DAY_MS);
}

export function addDays(day, n) {
  return new Date(parseDay(day).getTime() + n * DAY_MS).toISOString().slice(0, 10);
}
