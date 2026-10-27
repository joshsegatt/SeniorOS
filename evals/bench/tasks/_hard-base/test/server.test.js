import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/server.js';

const admin = { authorization: 'Bearer tok-admin' };

test('rejects requests without a token', () => {
  assert.equal(createApp().handle({ method: 'GET', path: '/users' }).status, 401);
});

test('lists users', () => {
  const res = createApp().handle({ method: 'GET', path: '/users', headers: admin });
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 3);
});

test('gets a user by id', () => {
  assert.equal(createApp().handle({ method: 'GET', path: '/users/u2', headers: admin }).body.name, 'Bob');
});

test('unknown user is 404', () => {
  assert.equal(createApp().handle({ method: 'GET', path: '/users/nope', headers: admin }).status, 404);
});
