const ACTIVE = new Set(['open', 'pending']);
const PRIORITY_ORDER = { high: 0, normal: 1, low: 2 };

/**
 * The tickets an agent is working on: open or pending tickets assigned to them, most urgent first, then oldest.
 * @param {ReturnType<import('./store.js').createTicketStore>} store
 * @param {string} agentId
 */
export function inbox(store, agentId) {
  return store
    .all()
    .filter((t) => ACTIVE.has(t.status) && t.assignee === agentId)
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
    .filter((t) => ACTIVE.has(t.status) && !t.assignee)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((t) => t.id);
}
