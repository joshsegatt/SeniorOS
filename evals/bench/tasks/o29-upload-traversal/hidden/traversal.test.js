import test from 'node:test';
import assert from 'node:assert/strict';
import { createDisk } from '../../src/files/disk.js';
import { createFilesApp } from '../../src/files/app.js';

const SECRET = 'STRIPE_KEY=sk_live_test_only';

function setup() {
  const disk = createDisk({
    '/srv/app/config/secrets.env': SECRET,
    '/srv/app/uploads-old/customers.csv': 'ana@example.com,old export',
    '/srv/app/uploads/albums/2026/cover.jpg': 'JPEG cover',
    '/srv/app/uploads/.thumbs/200/albums/2026/cover.jpg': 'JPEG cover 200',
    '/srv/app/uploads/avatars/ana.png': 'PNG ana',
  });
  const users = new Map([['ana', { name: 'Ana' }], ['eve', { name: 'Eve' }]]);
  return { disk, users, app: createFilesApp({ disk, users }) };
}

const refused = (res, what) => {
  assert.ok(res.status >= 400, `${what}: expected an error status, got ${res.status}`);
  assert.ok(!String(res.body).includes('sk_live') && !String(res.body).includes('old export'), `${what}: leaked a file outside uploads`);
};

test('the reported download url no longer reads outside uploads', () => {
  const { app } = setup();
  refused(app.handle({ method: 'GET', url: '/files/..%2Fconfig%2Fsecrets.env' }), 'reported url');
  refused(app.handle({ method: 'GET', url: '/files/albums%2F..%2F..%2F..%2Fconfig%2Fsecrets.env' }), 'nested');
  refused(app.handle({ method: 'GET', url: '/files/..%2Fuploads-old%2Fcustomers.csv' }), 'sibling folder with the same prefix');
  refused(app.handle({ method: 'GET', url: '/files/%2Fsrv%2Fapp%2Fconfig%2Fsecrets.env' }), 'absolute path');
});

test('thumbnails cannot be used to read outside uploads', () => {
  const { app } = setup();
  refused(app.handle({ method: 'GET', url: '/thumbs?file=../../../config/secrets.env&size=200' }), 'file');
  refused(app.handle({ method: 'GET', url: '/thumbs?file=secrets.env&size=../../../config' }), 'size');
});

test('uploads cannot write outside uploads', () => {
  const { app, disk } = setup();
  for (const name of ['../config/secrets.env', 'albums/../../config/secrets.env', '../uploads-old/customers.csv']) {
    const res = app.handle({ method: 'POST', url: '/uploads', user: { id: 'eve' }, body: { name, content: 'pwned' } });
    assert.ok(res.status >= 400, `${name}: expected an error status, got ${res.status}`);
  }
  assert.equal(disk.read('/srv/app/config/secrets.env'), SECRET);
  assert.equal(disk.read('/srv/app/uploads-old/customers.csv'), 'ana@example.com,old export');
});

test('an avatar cannot point outside uploads', () => {
  const { app } = setup();
  const set = app.handle({ method: 'PUT', url: '/me/avatar', user: { id: 'eve' }, body: { file: '../config/secrets.env' } });
  const got = app.handle({ method: 'GET', url: '/users/eve/avatar' });
  assert.ok(set.status >= 400 || got.status >= 400, 'either setting or serving that avatar is refused');
  refused(got, 'avatar');
});

test('normal use keeps working', () => {
  const { app } = setup();
  assert.deepEqual(app.handle({ method: 'GET', url: '/files/albums%2F2026%2Fcover.jpg' }), { status: 200, body: 'JPEG cover' });
  assert.deepEqual(app.handle({ method: 'GET', url: '/thumbs?file=albums/2026/cover.jpg&size=200' }), { status: 200, body: 'JPEG cover 200' });
  const up = app.handle({ method: 'POST', url: '/uploads', user: { id: 'ana' }, body: { name: 'albums/2026/back.jpg', content: 'JPEG back' } });
  assert.equal(up.status, 201);
  assert.deepEqual(app.handle({ method: 'GET', url: up.body.url }), { status: 200, body: 'JPEG back' });
  assert.equal(app.handle({ method: 'PUT', url: '/me/avatar', user: { id: 'ana' }, body: { file: 'avatars/ana.png' } }).status, 204);
  assert.deepEqual(app.handle({ method: 'GET', url: '/users/ana/avatar' }), { status: 200, body: 'PNG ana' });
});
