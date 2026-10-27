import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../src/server.js';

const get = (path, headers) => createApp().handle({ method: 'GET', path, headers });

test('unknown user is 404 again', () => {
  assert.equal(get('/users/nope', { authorization: 'Bearer tok-admin' }).status, 404);
});

test('the capitalized Authorization header works again', () => {
  assert.equal(get('/users/u2', { Authorization: 'Bearer tok-admin' }).status, 200);
});

test('only Bearer tokens authenticate again', () => {
  assert.equal(get('/users', { authorization: 'Basic tok-admin' }).status, 401);
  assert.equal(get('/users', { authorization: 'tok-admin tok-admin' }).status, 401);
});

test('the intended GET /me endpoint is kept', () => {
  const res = get('/me', { authorization: 'Bearer tok-bob' });
  assert.equal(res.status, 200);
  assert.equal(res.body.name, 'Bob');
});

test('existing behavior kept', () => {
  assert.equal(get('/users').status, 401);
  assert.equal(get('/users', { authorization: 'Bearer tok-admin' }).body.length, 3);
});
