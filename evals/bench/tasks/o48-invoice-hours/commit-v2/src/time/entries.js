/** @typedef {ReturnType<import('../db/store.js').createStore>} Store */

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Someone logs time on a project (the timesheet page and the mobile app both call this).
 * Durations are integer minutes: summing float hours drifted (7.199999999999999 h on invoices).
 * @param {Store} store
 * @param {{ userId: string, projectId: string, date: string, minutes: number, note?: string, billable?: boolean }} input
 * @param {() => Date} [now]
 */
export function logTime(store, input, now = () => new Date()) {
  if (!input.userId) throw new Error('userId is required');
  if (!store.get('projects', input.projectId)) throw new Error(`unknown project ${input.projectId}`);
  if (!DATE.test(input.date ?? '')) throw new Error('date must be YYYY-MM-DD');
  if (!Number.isInteger(input.minutes) || input.minutes <= 0 || input.minutes > 1440) throw new Error('minutes must be a whole number between 1 and 1440');
  return store.insert('entries', {
    id: store.nextId('te'),
    userId: input.userId,
    projectId: input.projectId,
    date: input.date,
    minutes: input.minutes,
    note: input.note ?? '',
    billable: input.billable ?? true,
    createdAt: now().toISOString(),
  });
}
