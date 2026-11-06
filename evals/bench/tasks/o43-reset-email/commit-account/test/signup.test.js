import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAccountApp } from '../src/account/app.js';

const auditFile = () => join(mkdtempSync(join(tmpdir(), 'signup-')), 'audit.log');

test('signs up and sends the welcome email with a verification link', async () => {
  const app = createAccountApp({ auditFile: auditFile() });
  const res = await app.handle({ method: 'POST', path: '/signup', body: { email: 'Lee@Example.test', name: 'Lee', password: 'long enough pw' } });
  assert.equal(res.status, 201);
  assert.equal(app.transport.sent.length, 1);
  assert.equal(app.transport.sent[0].subject, 'Welcome to the shop');
  const token = /verify\?token=([0-9a-f]{32})/.exec(app.transport.sent[0].body)[1];
  assert.equal((await app.handle({ method: 'POST', path: '/verification/confirm', body: { token } })).status, 200);
  assert.equal(app.users.get(res.body.id).verified, true);
});

test('sign-up answers 503 when the welcome email cannot be sent', async () => {
  const transport = { send: async () => { throw new Error('relay unavailable'); } };
  const app = createAccountApp({ transport, auditFile: auditFile() });
  const res = await app.handle({ method: 'POST', path: '/signup', body: { email: 'lee@example.test', name: 'Lee', password: 'long enough pw' } });
  assert.deepEqual(res, { status: 503, body: { error: 'email_unavailable' } });
});

test('rejects a short password', async () => {
  const app = createAccountApp({ auditFile: auditFile() });
  const res = await app.handle({ method: 'POST', path: '/signup', body: { email: 'lee@example.test', name: 'Lee', password: 'short' } });
  assert.equal(res.status, 400);
});

test('verification resend is refused for a verified account', async () => {
  const app = createAccountApp({ auditFile: auditFile() });
  const user = app.users.add({ email: 'max@example.test', name: 'Max', password: 'whatever pw 1', verified: true });
  assert.equal((await app.handle({ method: 'POST', path: '/verification/resend', body: { userId: user.id } })).status, 409);
});
