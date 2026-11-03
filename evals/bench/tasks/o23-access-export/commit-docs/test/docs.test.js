import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryDb } from '../src/docs/memory-db.js';
import { can, canView, principalsOf } from '../src/docs/permissions.js';
import { Forbidden, openDocument, visibleHits } from '../src/docs/api.js';
import { largestWorkspaceData } from '../src/docs/seed.js';

function db() {
  return createMemoryDb({
    memberships: { ana: ['design'], ben: ['sales'], cy: [] },
    groupParents: { design: ['product'], product: ['staff'], sales: ['staff'] },
    folders: [
      { id: 'root', parentId: null, acl: [{ principal: 'group:product', level: 'view' }] },
      { id: 'specs', parentId: 'root', acl: [] },
      { id: 'deals', parentId: null, acl: [{ principal: 'group:sales', level: 'edit' }] },
    ],
    documents: [
      { id: 'd1', workspaceId: 'w1', title: 'Roadmap', folderId: 'specs', ownerId: 'cy', acl: [] },
      { id: 'd2', workspaceId: 'w1', title: 'Pipeline', folderId: 'deals', ownerId: 'ben', acl: [{ principal: 'user:ana', level: 'comment' }] },
      { id: 'd3', workspaceId: 'w1', title: 'Notes', folderId: null, ownerId: 'cy', acl: [] },
    ],
  });
}

test('nested groups', async () => {
  assert.deepEqual([...(await principalsOf(db(), 'ana'))].sort(), ['group:design', 'group:product', 'group:staff', 'user:ana']);
});

test('view through a folder above, a direct entry, or ownership', async () => {
  const d = db();
  const [roadmap, pipeline, notes] = await Promise.all(['d1', 'd2', 'd3'].map((id) => d.document(id)));
  assert.equal(await canView(d, 'ana', roadmap), true);
  assert.equal(await canView(d, 'ben', roadmap), false);
  assert.equal(await canView(d, 'ana', pipeline), true);
  assert.equal(await can(d, 'ana', pipeline, 'edit'), false);
  assert.equal(await can(d, 'ben', pipeline, 'edit'), true);
  assert.equal(await canView(d, 'cy', notes), true);
  assert.equal(await canView(d, 'ana', notes), false);
});

test('document endpoints', async () => {
  const d = db();
  assert.equal((await openDocument(d, 'ana', 'd1')).title, 'Roadmap');
  await assert.rejects(openDocument(d, 'ben', 'd3'), Forbidden);
  const hits = await Promise.all(['d1', 'd2', 'd3'].map((id) => d.document(id)));
  assert.deepEqual((await visibleHits(d, 'ben', hits)).map((x) => x.id), ['d2']);
});

test('dev seed', () => {
  const data = largestWorkspaceData();
  assert.equal(data.documents.length, 15_000);
  assert.equal(data.folders.length, 600);
});
