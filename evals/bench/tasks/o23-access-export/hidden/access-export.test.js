import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryDb } from '../../src/docs/memory-db.js';
import { largestWorkspaceData } from '../../src/docs/seed.js';
import { exportableDocuments } from '../../src/docs/export.js';

/** Counts queries; production runs each one against Postgres. */
function counting(db, limit = 5_000) {
  const counter = { queries: 0 };
  const wrapped = {};
  for (const name of ['userGroups', 'parentGroups', 'folder', 'document', 'documents']) {
    wrapped[name] = async (...args) => {
      counter.queries += 1;
      if (counter.queries > limit) throw new Error(`test: more than ${limit} database queries`);
      return db[name](...args);
    };
  }
  return { db: wrapped, counter };
}

const small = () =>
  createMemoryDb({
    memberships: { ana: ['design'], ben: ['sales'], cy: [] },
    groupParents: { design: ['product'], product: ['staff'], sales: ['staff'] },
    folders: [
      { id: 'root', parentId: null, acl: [{ principal: 'group:product', level: 'view' }] },
      { id: 'specs', parentId: 'root', acl: [] },
      { id: 'deals', parentId: null, acl: [{ principal: 'group:sales', level: 'edit' }] },
      { id: 'hr', parentId: null, acl: [{ principal: 'group:staff', level: 'admin' }] },
    ],
    documents: [
      { id: 'd1', workspaceId: 'w1', title: 'Roadmap', folderId: 'specs', ownerId: 'cy', acl: [] },
      { id: 'd2', workspaceId: 'w1', title: 'Pipeline', folderId: 'deals', ownerId: 'ben', acl: [{ principal: 'user:ana', level: 'comment' }] },
      { id: 'd3', workspaceId: 'w1', title: 'Notes', folderId: null, ownerId: 'cy', acl: [] },
      { id: 'd4', workspaceId: 'w1', title: 'Forecast', folderId: 'deals', ownerId: 'ben', acl: [] },
      { id: 'd5', workspaceId: 'w1', title: 'Handbook', folderId: 'hr', ownerId: 'cy', acl: [] },
      { id: 'd6', workspaceId: 'w2', title: 'Other workspace', folderId: null, ownerId: 'ana', acl: [] },
    ],
  });

const ids = (docs) => docs.map((d) => d.id);

test('lists the documents the user can view, sorted by title', async () => {
  const db = small();
  assert.deepEqual(ids(await exportableDocuments(db, 'ana', 'w1')), ['d5', 'd2', 'd1']);
  assert.deepEqual(ids(await exportableDocuments(db, 'ben', 'w1')), ['d4', 'd5', 'd2']);
  assert.deepEqual(ids(await exportableDocuments(db, 'cy', 'w1')), ['d5', 'd3', 'd1']);
  assert.deepEqual(ids(await exportableDocuments(db, 'ana', 'w2')), ['d6']);
  const [first] = await exportableDocuments(db, 'ana', 'w1');
  assert.equal(first.title, 'Handbook');
});

/** Independent reference over the raw seed data. */
function expectedFor(data, userId) {
  const principals = new Set([`user:${userId}`]);
  const queue = [...(data.memberships[userId] ?? [])];
  while (queue.length) {
    const g = queue.shift();
    if (principals.has(`group:${g}`)) continue;
    principals.add(`group:${g}`);
    queue.push(...(data.groupParents[g] ?? []));
  }
  const folders = new Map(data.folders.map((f) => [f.id, f]));
  const grants = (acl) => acl.some((e) => principals.has(e.principal));
  return data.documents
    .filter((d) => {
      if (d.ownerId === userId || grants(d.acl)) return true;
      for (let f = folders.get(d.folderId); f; f = f.parentId ? folders.get(f.parentId) : null) if (grants(f.acl)) return true;
      return false;
    })
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((d) => d.id);
}

test("exporting our largest customer's workspace takes a bounded number of queries", async () => {
  const data = largestWorkspaceData();
  for (const userId of ['u5', 'u123']) {
    const { db, counter } = counting(createMemoryDb(data));
    const docs = await exportableDocuments(db, userId, 'ws-big');
    const expected = expectedFor(data, userId);
    assert.ok(expected.length > 1_000);
    assert.deepEqual(ids(docs), expected);
    assert.ok(counter.queries <= 2_000, `${counter.queries} queries to export ${data.documents.length} documents`);
  }
});
