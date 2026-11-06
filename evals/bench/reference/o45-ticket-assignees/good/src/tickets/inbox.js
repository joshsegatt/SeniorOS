const ACTIVE = new Set(['open', 'pending']);
const PRIORITY_ORDER = { high: 0, normal: 1, low: 2 };

/**
 * The tickets an agent is working on: open or pending tickets they are one of the assignees of, most urgent first, then oldest.
 * @param {ReturnType<import('./store.js').createTicketStore>} store
 * @param {string} agentId
 */
export function inbox(store, agentId) {
  return store
    .all()
    .filter((t) => ACTIVE.has(t.status) && t.assignees.includes(agentId))
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.createdAt.localeCompare(b.createdAt))
    .map((t) => t.id);
}

/**
 * The triage queue: open or pending tickets nobody is assigned to, oldest first.
 * @param {ReturnType<import('./store.js').createTicketStore>} store
 */
export function triage(store) {
  return store
    .all()
    .filter((t) => ACTIVE.has(t.status) && t.assignees.length === 0)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((t) => t.id);
}
