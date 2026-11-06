/**
 * The members page in workspace settings.
 * @param {ReturnType<import('../teams/store.js').createTeamStore>} store
 * @param {string} workspaceId
 */
export function membersPage(store, workspaceId) {
  const workspace = store.workspace(workspaceId);
  const all = store.membersOf(workspaceId);
  const members = all.filter((m) => m.status === 'active').sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
  const invites = all.filter((m) => m.status === 'invited');
  return {
    heading: `${workspace.name}: ${members.length} ${members.length === 1 ? 'member' : 'members'}`,
    members: members.map((m) => ({ name: m.name || m.email, email: m.email, role: m.role })),
    pendingInvites: invites.map((m) => m.email),
  };
}
