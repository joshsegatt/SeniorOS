import test from 'node:test';
import assert from 'node:assert/strict';
import { createDisk } from '../src/files/disk.js';
import { createFilesApp } from '../src/files/app.js';

function setup() {
  const disk = createDisk({
    '/srv/app/uploads/albums/2026/cover.jpg': 'JPEG cover',
    '/srv/app/uploads/.thumbs/200/albums/2026/cover.jpg': 'JPEG cover 200',
    '/srv/app/uploads/avatars/ana.png': 'PNG ana',
  });
  const users = new Map([['ana', { name: 'Ana' }]]);
  return { disk, users, app: createFilesApp({ disk, users }) };
}

test('files and thumbnails are served from the uploads folder', () => {
  const { app } = setup();
  assert.deepEqual(app.handle({ method: 'GET', url: '/files/albums%2F2026%2Fcover.jpg' }), { status: 200, body: 'JPEG cover' });
  assert.deepEqual(app.handle({ method: 'GET', url: '/thumbs?file=albums/2026/cover.jpg&size=200' }), { status: 200, body: 'JPEG cover 200' });
  assert.equal(app.handle({ method: 'GET', url: '/files/nope.jpg' }).status, 404);
});

test('uploads are stored and can be downloaded', () => {
  const { app } = setup();
  const res = app.handle({ method: 'POST', url: '/uploads', user: { id: 'ana' }, body: { name: 'albums/2026/back.jpg', content: 'JPEG back' } });
  assert.equal(res.status, 201);
  assert.deepEqual(app.handle({ method: 'GET', url: res.body.url }), { status: 200, body: 'JPEG back' });
  assert.equal(app.handle({ method: 'POST', url: '/uploads', body: { name: 'a.jpg', content: 'x' } }).status, 401);
});

test('users pick one of their uploads as avatar', () => {
  const { app } = setup();
  assert.equal(app.handle({ method: 'PUT', url: '/me/avatar', user: { id: 'ana' }, body: { file: 'avatars/ana.png' } }).status, 204);
  assert.deepEqual(app.handle({ method: 'GET', url: '/users/ana/avatar' }), { status: 200, body: 'PNG ana' });
  assert.equal(app.handle({ method: 'GET', url: '/users/bob/avatar' }).status, 404);
});
