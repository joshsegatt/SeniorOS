/**
 * In-memory workspace store (production uses the same interface over Postgres).
 * @typedef {{ id: string, name: string, seats: number }} Workspace
 * @typedef {{ id: string, workspaceId: string, email: string, name: string, role: 'owner' | 'admin' | 'member', status: 'invited' | 'active' | 'removed' | 'deprovisioned', scimId?: string, invitedAt: string, joinedAt: string | null, removedAt: string | null }} Member
 */
export function createTeamStore() {
  /** @type {Map<string, Workspace>} */
  const workspaces = new Map();
  /** @type {Member[]} */
  const members = [];
  let seq = 80;
  return {
    /** @param {'w' | 'm'} prefix */
    nextId(prefix) {
      seq += 1;
      return `${prefix}-${seq}`;
    },
    /** @param {Workspace} workspace */
    addWorkspace(workspace) {
      workspaces.set(workspace.id, { ...workspace });
      return { ...workspace };
    },
    /** @param {string} id */
    workspace(id) {
      const found = workspaces.get(id);
      if (!found) throw new Error(`unknown workspace ${id}`);
      return { ...found };
    },
    /** @param {Member} member */
    insertMember(member) {
      members.push({ ...member });
      return { ...member };
    },
    /** @param {string} id @param {Partial<Member>} patch */
    updateMember(id, patch) {
      const found = members.find((m) => m.id === id);
      if (!found) throw new Error(`unknown member ${id}`);
      Object.assign(found, patch);
      return { ...found };
    },
    /** @param {string} id */
    member(id) {
      const found = members.find((m) => m.id === id);
      return found ? { ...found } : null;
    },
    /** @param {string} workspaceId */
    membersOf(workspaceId) {
      return members.filter((m) => m.workspaceId === workspaceId).map((m) => ({ ...m }));
    },
  };
}

/** Loads a support export (data/workspace-*.json). @param {{ workspace: Workspace, members: Member[] }} data */
export function loadExport(data) {
  const store = createTeamStore();
  store.addWorkspace(data.workspace);
  for (const m of data.members) store.insertMember(m);
  return store;
}
