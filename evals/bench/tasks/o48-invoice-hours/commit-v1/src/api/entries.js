/** @typedef {ReturnType<import('../db/store.js').createStore>} Store */

/**
 * GET /api/entries?userId=&projectId=&from=&to= for the mobile app and the client portal.
 * @param {Store} store
 * @param {{ userId?: string, projectId?: string, from?: string, to?: string }} query dates inclusive
 */
export function listEntries(store, query = {}) {
  return store
    .all('entries')
    .filter((e) => (!query.userId || e.userId === query.userId) && (!query.projectId || e.projectId === query.projectId))
    .filter((e) => (!query.from || e.date >= query.from) && (!query.to || e.date <= query.to))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    .map((e) => ({ id: e.id, userId: e.userId, projectId: e.projectId, date: e.date, hours: e.hours, billable: e.billable, note: e.note }));
}
