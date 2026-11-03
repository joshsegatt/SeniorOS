/**
 * In-memory implementation of the Db interface (see permissions.js) for tests and local dev.
 * Production uses the Postgres adapter (platform repo) with the same methods; each call is one query.
 * @param {{
 *   memberships?: Record<string, string[]>,
 *   groupParents?: Record<string, string[]>,
 *   folders?: import('./permissions.js').Folder[],
 *   documents?: import('./permissions.js').Doc[],
 * }} data
 * @returns {import('./permissions.js').Db}
 */
export function createMemoryDb({ memberships = {}, groupParents = {}, folders = [], documents = [] }) {
  const folderById = new Map(folders.map((f) => [f.id, f]));
  const docById = new Map(documents.map((d) => [d.id, d]));
  const copy = (v) => (v == null ? null : structuredClone(v));
  return {
    async userGroups(userId) {
      return [...(memberships[userId] ?? [])];
    },
    async parentGroups(groupId) {
      return [...(groupParents[groupId] ?? [])];
    },
    async folder(folderId) {
      return copy(folderById.get(folderId));
    },
    async document(docId) {
      return copy(docById.get(docId));
    },
    async documents(workspaceId) {
      return documents.filter((d) => d.workspaceId === workspaceId).map((d) => structuredClone(d));
    },
  };
}
