/** @typedef {ReturnType<import('../db/store.js').createStore>} Store */

/**
 * How much of a project's budget (in hours) has been used, for the project page and the 80% alert.
 * @param {Store} store
 * @param {string} projectId
 */
export function budgetUsed(store, projectId) {
  const project = store.get('projects', projectId);
  if (!project) throw new Error(`unknown project ${projectId}`);
  const usedMinutes = store
    .all('entries')
    .filter((e) => e.projectId === projectId)
    .reduce((sum, e) => sum + (e.minutes ?? 0), 0);
  const percent = Math.round((usedMinutes / (project.budgetHours * 60)) * 100);
  return { projectId, usedHours: usedMinutes / 60, budgetHours: project.budgetHours, percent, alert: percent >= 80 };
}
