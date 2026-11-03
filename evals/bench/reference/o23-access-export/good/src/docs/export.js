import { principalsOf } from './permissions.js';

/**
 * Documents of a workspace the user can view, for the "Download workspace" zip.
 * Same rules as canView, but the user's groups are resolved once and each folder is read once:
 * canView per document re-reads both, which is ~13 queries per document.
 * @param {import('./permissions.js').Db} db
 * @param {string} userId
 * @param {string} workspaceId
 */
export async function exportableDocuments(db, userId, workspaceId) {
  const [docs, principals] = await Promise.all([db.documents(workspaceId), principalsOf(db, userId)]);
  /** @param {import('./permissions.js').AclEntry[]} acl */
  const grants = (acl) => acl.some((e) => principals.has(e.principal));
  /** @type {Map<string, Promise<boolean>>} */
  const folderGrants = new Map();
  /** @param {string | null} folderId @returns {Promise<boolean>} */
  const folderAllows = (folderId) => {
    if (!folderId) return Promise.resolve(false);
    let p = folderGrants.get(folderId);
    if (!p) {
      p = db.folder(folderId).then((f) => (f ? grants(f.acl) || folderAllows(f.parentId) : false));
      folderGrants.set(folderId, p);
    }
    return p;
  };
  const visible = [];
  for (const doc of docs) {
    if (doc.ownerId === userId || grants(doc.acl) || (await folderAllows(doc.folderId))) visible.push({ id: doc.id, title: doc.title });
  }
  return visible.sort((a, b) => a.title.localeCompare(b.title));
}
