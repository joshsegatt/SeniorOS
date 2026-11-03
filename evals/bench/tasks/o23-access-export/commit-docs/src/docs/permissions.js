/**
 * Who can see what. A user can view a document they own, or one whose ACL (or the ACL of its folder or any
 * folder above it) grants view or higher to the user or to a group they belong to. Groups nest: a member of
 * "Design" is also a member of every group "Design" is in.
 *
 * @typedef {{ principal: string, level: 'view' | 'comment' | 'edit' | 'admin' }} AclEntry   principal: 'user:<id>' | 'group:<id>'
 * @typedef {{ id: string, workspaceId: string, title: string, folderId: string | null, ownerId: string, acl: AclEntry[] }} Doc
 * @typedef {{ id: string, parentId: string | null, acl: AclEntry[] }} Folder
 * @typedef {{
 *   userGroups(userId: string): Promise<string[]>,
 *   parentGroups(groupId: string): Promise<string[]>,
 *   folder(folderId: string): Promise<Folder | null>,
 *   document(docId: string): Promise<Doc | null>,
 *   documents(workspaceId: string): Promise<Doc[]>,
 * }} Db
 */

const RANK = { view: 1, comment: 2, edit: 3, admin: 4 };

/**
 * @param {Db} db
 * @param {string} userId
 * @param {Doc} doc
 * @param {keyof typeof RANK} [level]
 */
export async function can(db, userId, doc, level = 'view') {
  if (doc.ownerId === userId) return true;
  const principals = await principalsOf(db, userId);
  const entries = [...doc.acl, ...(await folderAcl(db, doc.folderId))];
  return entries.some((e) => principals.has(e.principal) && RANK[e.level] >= RANK[level]);
}

/** @param {Db} db @param {string} userId @param {Doc} doc */
export function canView(db, userId, doc) {
  return can(db, userId, doc, 'view');
}

/**
 * The user and every group they are in, directly or through nesting.
 * @param {Db} db
 * @param {string} userId
 */
export async function principalsOf(db, userId) {
  const principals = new Set([`user:${userId}`]);
  const queue = [...(await db.userGroups(userId))];
  while (queue.length > 0) {
    const groupId = /** @type {string} */ (queue.shift());
    if (principals.has(`group:${groupId}`)) continue;
    principals.add(`group:${groupId}`);
    queue.push(...(await db.parentGroups(groupId)));
  }
  return principals;
}

/** ACL entries inherited from the folder and the folders above it. @param {Db} db @param {string | null} folderId */
async function folderAcl(db, folderId) {
  const entries = [];
  for (let id = folderId; id; ) {
    const folder = await db.folder(id);
    if (!folder) break;
    entries.push(...folder.acl);
    id = folder.parentId;
  }
  return entries;
}
