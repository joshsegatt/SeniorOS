/** @typedef {ReturnType<import('../db/store.js').createStore>} Store */

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Someone logs time on a project (the timesheet page and the mobile app both call this).
 * @param {Store} store
 * @param {{ userId: string, projectId: string, date: string, hours: number, note?: string, billable?: boolean }} input
 * @param {() => Date} [now]
 */
export function logTime(store, input, now = () => new Date()) {
  if (!input.userId) throw new Error('userId is required');
  if (!store.get('projects', input.projectId)) throw new Error(`unknown project ${input.projectId}`);
  if (!DATE.test(input.date ?? '')) throw new Error('date must be YYYY-MM-DD');
  if (typeof input.hours !== 'number' || !(input.hours > 0) || input.hours > 24) throw new Error('hours must be between 0 and 24');
  return store.insert('entries', {
    id: store.nextId('te'),
    userId: input.userId,
    projectId: input.projectId,
    date: input.date,
    hours: input.hours,
    note: input.note ?? '',
    billable: input.billable ?? true,
    createdAt: now().toISOString(),
  });
}
