import { createMemoryDb } from './memory-db.js';

/**
 * Local dev data shaped like our largest customer workspace: ~15k documents in ~600 folders up to
 * 5 levels deep, 40 groups nested 3 levels, members in several groups each.
 */
export function largestWorkspaceData() {
  const groupParents = {};
  for (let g = 0; g < 40; g += 1) groupParents[`g${g}`] = g < 4 ? [] : [`g${Math.floor((g - 4) / 3)}`];
  const memberships = {};
  for (let u = 0; u < 300; u += 1) memberships[`u${u}`] = [`g${(u * 7) % 40}`, `g${(u * 11 + 3) % 40}`, `g${(u * 13 + 5) % 40}`];

  const folders = [];
  for (let f = 0; f < 600; f += 1) {
    const parentId = f < 5 ? null : `f${Math.floor((f - 5) / 4)}`;
    const acl = f % 9 === 0 ? [{ principal: `group:g${f % 40}`, level: /** @type {const} */ (f % 2 ? 'edit' : 'view') }] : [];
    folders.push({ id: `f${f}`, parentId, acl });
  }
  const documents = [];
  for (let d = 0; d < 15_000; d += 1) {
    const acl = d % 17 === 0 ? [{ principal: `user:u${d % 300}`, level: /** @type {const} */ ('comment') }] : [];
    documents.push({ id: `d${d}`, workspaceId: 'ws-big', title: `Doc ${String(d).padStart(5, '0')}`, folderId: `f${(d * 31) % 600}`, ownerId: `u${(d * 3) % 300}`, acl });
  }
  return { groupParents, memberships, folders, documents };
}

export function largestWorkspaceDb() {
  return createMemoryDb(largestWorkspaceData());
}
