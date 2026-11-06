import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAccountApp } from '../src/account/app.js';

function appWithCustomer() {
  const app = createAccountApp({ auditFile: join(mkdtempSync(join(tmpdir(), 'reset-')), 'audit.log') });
  const user = app.users.add({ email: 'kim@example.test', name: 'Kim', password: 'old password 1', verified: true });
  return { app, user };
}

test('emails a reset link to a known address', async () => {
  const { app } = appWithCustomer();
  const res = await app.handle({ method: 'POST', path: '/password-reset', body: { email: ' Kim@Example.test ' } });
  assert.equal(res.status, 202);
  assert.equal(app.transport.sent.length, 1);
  assert.equal(app.transport.sent[0].to, 'kim@example.test');
  assert.equal(app.transport.sent[0].subject, 'Reset your password');
  assert.match(app.transport.sent[0].body, /https:\/\/shop\.example\.test\/reset\?token=[0-9a-f]{32}/);
});

test('answers 202 for an unknown address without sending anything', async () => {
  const { app } = appWithCustomer();
  const res = await app.handle({ method: 'POST', path: '/password-reset', body: { email: 'nobody@example.test' } });
  assert.equal(res.status, 202);
  assert.equal(app.transport.sent.length, 0);
});

test('a reset token sets the new password once', async () => {
  const { app, user } = appWithCustomer();
  const token = app.tokens.issue(user.id, 'password-reset', 60_000);
  const confirm = { method: 'POST', path: '/password-reset/confirm', body: { token, password: 'new password 22' } };
  assert.equal((await app.handle(confirm)).status, 200);
  assert.equal(app.users.get(user.id).password, 'new password 22');
  assert.equal((await app.handle(confirm)).status, 400);
});
