import { canView } from './permissions.js';

/**
 * Documents of a workspace the user can view, for the "Download workspace" zip.
 * @param {import('./permissions.js').Db} db
 * @param {string} userId
 * @param {string} workspaceId
 */
export async function exportableDocuments(db, userId, workspaceId) {
  const docs = await db.documents(workspaceId);
  const allowed = await Promise.all(docs.map((doc) => canView(db, userId, doc)));
  return docs
    .filter((_, i) => allowed[i])
    .map((d) => ({ id: d.id, title: d.title }))
    .sort((a, b) => a.title.localeCompare(b.title));
}
