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
      const minutes = store
        .all('entries')
        .filter((e) => e.projectId === project.id && e.billable && e.date.slice(0, 7) === month)
        .reduce((sum, e) => sum + (e.minutes ?? Math.round((e.hours ?? 0) * 60)), 0);
      return { projectId: project.id, name: project.name, minutes, hours: minutes / 60, amountCents: Math.round((minutes * project.hourlyRateCents) / 60) };
    })
    .filter((line) => line.minutes > 0);
}

/** @param {Store} store @param {string} clientId @param {string} month */
export function invoiceTotal(store, clientId, month) {
  const lines = invoiceLines(store, clientId, month);
  const minutes = lines.reduce((s, l) => s + l.minutes, 0);
  return { minutes, hours: minutes / 60, amountCents: lines.reduce((s, l) => s + l.amountCents, 0) };
}
