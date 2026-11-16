/** @typedef {ReturnType<import('../db/store.js').createStore>} Store */

/**
 * The lines of a client's monthly invoice: billable time per project at the project's hourly rate.
 * @param {Store} store
 * @param {string} clientId
 * @param {string} month "2026-10"
 */
export function invoiceLines(store, clientId, month) {
  const projects = store.all('projects').filter((p) => p.clientId === clientId);
  return projects
    .map((project) => {
      const hours = store
        .all('entries')
        .filter((e) => e.projectId === project.id && e.billable && e.date.slice(0, 7) === month)
        .reduce((sum, e) => sum + (e.hours ?? 0), 0);
      return { projectId: project.id, name: project.name, hours, amountCents: Math.round(hours * project.hourlyRateCents) };
    })
    .filter((line) => line.hours > 0);
}

/** @param {Store} store @param {string} clientId @param {string} month */
export function invoiceTotal(store, clientId, month) {
  const lines = invoiceLines(store, clientId, month);
  return { hours: lines.reduce((s, l) => s + l.hours, 0), amountCents: lines.reduce((s, l) => s + l.amountCents, 0) };
}
