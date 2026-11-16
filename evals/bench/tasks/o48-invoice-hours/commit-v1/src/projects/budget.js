/** @typedef {ReturnType<import('../db/store.js').createStore>} Store */

/**
 * How much of a project's budget (in hours) has been used, for the project page and the 80% alert.
 * @param {Store} store
 * @param {string} projectId
 */
export function budgetUsed(store, projectId) {
  const project = store.get('projects', projectId);
  if (!project) throw new Error(`unknown project ${projectId}`);
  const usedHours = store
    .all('entries')
    .filter((e) => e.projectId === projectId)
    .reduce((sum, e) => sum + (e.hours ?? 0), 0);
  const percent = Math.round((usedHours / project.budgetHours) * 100);
  return { projectId, usedHours, budgetHours: project.budgetHours, percent, alert: percent >= 80 };
}
