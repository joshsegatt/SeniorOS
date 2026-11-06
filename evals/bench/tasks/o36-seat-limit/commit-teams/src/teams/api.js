/** @typedef {ReturnType<import('./store.js').createTeamStore>} TeamStore */

/**
 * Public API `GET /v1/workspaces/:id/members`: current members and pending invites, by email.
 * Customers use it to sync their directory and audit who has access.
 * @param {TeamStore} store
 * @param {string} workspaceId
 */
export function listMembers(store, workspaceId) {
  return store
    .membersOf(workspaceId)
    .filter((m) => !m.removedAt)
    .map((m) => ({ id: m.id, email: m.email, name: m.name, role: m.role, pending: m.status === 'invited' }))
    .sort((a, b) => a.email.localeCompare(b.email));
}
