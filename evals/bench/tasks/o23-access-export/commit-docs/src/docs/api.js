import { canView } from './permissions.js';

export class Forbidden extends Error {}

/** GET /docs/:id @param {import('./permissions.js').Db} db @param {string} userId @param {string} docId */
export async function openDocument(db, userId, docId) {
  const doc = await db.document(docId);
  if (!doc || !(await canView(db, userId, doc))) throw new Forbidden(docId);
  return doc;
}

/**
 * Search results page: the search service returns up to 20 hits; drop the ones the user can't see.
 * @param {import('./permissions.js').Db} db
 * @param {string} userId
 * @param {import('./permissions.js').Doc[]} hits
 */
export async function visibleHits(db, userId, hits) {
  const visible = [];
  for (const doc of hits) if (await canView(db, userId, doc)) visible.push(doc);
  return visible;
}
