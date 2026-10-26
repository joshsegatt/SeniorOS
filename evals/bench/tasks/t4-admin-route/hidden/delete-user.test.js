import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/server.js';

const admin = { authorization: 'Bearer tok-admin' };
const bob = { authorization: 'Bearer tok-bob' };

test('admin deletes a user', () => {
  const app = createApp();
  assert.equal(app.handle({ method: 'DELETE', path: '/users/u3', headers: admin }).status, 204);
  assert.equal(app.handle({ method: 'GET', path: '/users/u3', headers: admin }).status, 404);
  assert.equal(app.handle({ method: 'GET', path: '/users', headers: admin }).body.length, 2);
});

test('member gets 403 and nothing is deleted', () => {
  const app = createApp();
  assert.equal(app.handle({ method: 'DELETE', path: '/users/u3', headers: bob }).status, 403);
  assert.equal(app.handle({ method: 'DELETE', path: '/users/u2', headers: bob }).status, 403);
  assert.equal(app.handle({ method: 'GET', path: '/users', headers: admin }).body.length, 3);
});

test('no token gets 401', () => {
  const app = createApp();
  assert.equal(app.handle({ method: 'DELETE', path: '/users/u3' }).status, 401);
  assert.equal(app.handle({ method: 'DELETE', path: '/users/u3', headers: { authorization: 'Bearer nope' } }).status, 401);
});

test('missing user gets 404', () => {
  assert.equal(createApp().handle({ method: 'DELETE', path: '/users/zz', headers: admin }).status, 404);
});

test('existing routes unchanged', () => {
  const app = createApp();
  assert.equal(app.handle({ method: 'GET', path: '/users/u2', headers: bob }).body.name, 'Bob');
  assert.equal(app.handle({ method: 'GET', path: '/users' }).status, 401);
});
