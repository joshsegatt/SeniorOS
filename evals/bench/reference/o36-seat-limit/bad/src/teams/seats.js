/** @typedef {ReturnType<import('./store.js').createTeamStore>} TeamStore */

/** Seats taken in the workspace: members and pending invites. Users deprovisioned by SCIM have no removedAt. @param {TeamStore} store @param {string} workspaceId */
export function seatsUsed(store, workspaceId) {
  return store.membersOf(workspaceId).filter((m) => !m.removedAt && m.status !== 'deprovisioned').length;
}

/** @param {TeamStore} store @param {string} workspaceId */
export function seatsLeft(store, workspaceId) {
  return Math.max(0, store.workspace(workspaceId).seats - seatsUsed(store, workspaceId));
}

/** @param {TeamStore} store @param {string} workspaceId */
export function assertSeatAvailable(store, workspaceId) {
  if (seatsLeft(store, workspaceId) === 0) throw new Error('seat limit reached');
}
