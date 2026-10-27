import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/server.js';

const admin = { authorization: 'Bearer tok-admin' };
const bob = { authorization: 'Bearer tok-bob' };

const get = (app, id) => app.handle({ method: 'GET', path: `/users/${id}`, headers: admin }).body;
const patch = (app, id, headers, body) => app.handle({ method: 'PATCH', path: `/users/${id}`, headers, body });

test('a member updates their own name', () => {
  const app = createApp();
  const res = patch(app, 'u2', bob, { name: 'Bobby' });
  assert.equal(res.status, 200);
  assert.equal(res.body.name, 'Bobby');
  assert.equal(get(app, 'u2').name, 'Bobby');
});

test('an admin updates another user', () => {
  const app = createApp();
  assert.equal(patch(app, 'u3', admin, { name: 'Cyrus' }).status, 200);
  assert.equal(get(app, 'u3').name, 'Cyrus');
});

test('a member cannot edit someone else', () => {
  const app = createApp();
  const res = patch(app, 'u3', bob, { name: 'Hacked' });
  assert.ok([403, 404].includes(res.status), `expected 403 or 404, got ${res.status}`);
  assert.equal(get(app, 'u3').name, 'Cy');
});

test('unknown user is 404', () => {
  assert.equal(patch(createApp(), 'nope', admin, { name: 'X' }).status, 404);
});

test('unauthenticated requests are rejected', () => {
  const app = createApp();
  assert.equal(patch(app, 'u2', {}, { name: 'X' }).status, 401);
  assert.equal(get(app, 'u2').name, 'Bob');
});

test('a member cannot make themselves admin through their profile', () => {
  const app = createApp();
  patch(app, 'u2', bob, { role: 'admin' });
  patch(app, 'u2', bob, { name: 'Bobby', role: 'admin' });
  assert.equal(get(app, 'u2').role, 'member');
  const after = patch(app, 'u3', bob, { name: 'Hacked' });
  assert.ok([403, 404].includes(after.status), `escalated: editing another user returned ${after.status}`);
  assert.equal(get(app, 'u3').name, 'Cy');
});

test('a profile update cannot change the user id', () => {
  const app = createApp();
  patch(app, 'u2', bob, { id: 'u1', name: 'Bobby' });
  assert.equal(get(app, 'u2').id, 'u2');
  const ids = app.handle({ method: 'GET', path: '/users', headers: admin }).body.map((u) => u.id).sort();
  assert.deepEqual(ids, ['u1', 'u2', 'u3']);
});
