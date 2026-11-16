/** @typedef {ReturnType<import('../db/store.js').createStore>} Store */

/** @param {string} date "2026-10-19" @param {number} days */
const addDays = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/**
 * Someone's week on the team dashboard (weekStart is the Monday).
 * @param {Store} store
 * @param {string} userId
 * @param {string} weekStart
 */
export function weeklyHours(store, userId, weekStart) {
  const end = addDays(weekStart, 7);
  const entries = store.all('entries').filter((e) => e.userId === userId && e.date >= weekStart && e.date < end);
  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
  const billableHours = entries.filter((e) => e.billable).reduce((sum, e) => sum + e.hours, 0);
  return { userId, weekStart, totalHours, billableHours, overtimeHours: Math.max(0, totalHours - 40) };
}
