import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { createAccountApp } from '../../src/account/app.js';

const unhandled = [];
process.on('unhandledRejection', (reason) => unhandled.push(reason));

const auditFile = () => join(mkdtempSync(join(tmpdir(), 'hidden-reset-')), 'audit.log');

/** A relay that takes a while to accept a message, like the production SMTP relay under load. */
function slowRelay(ms = 40) {
  const sent = [];
  return { sent, async send(message) { await sleep(ms); sent.push(message); } };
}

function failingRelay() {
  const attempts = [];
  return { attempts, async send(message) { attempts.push(message); await sleep(5); throw new Error('421 relay unavailable'); } };
}

function withCustomer(transport) {
  const app = createAccountApp({ transport, auditFile: auditFile() });
  const user = app.users.add({ email: 'kim@example.test', name: 'Kim', password: 'old password 1', verified: false });
  return { app, user };
}

test('the reset endpoint answers only after the email was handed to a slow relay', async () => {
  const relay = slowRelay();
  const { app } = withCustomer(relay);
  const res = await app.handle({ method: 'POST', path: '/password-reset', body: { email: 'kim@example.test' } });
  assert.equal(res.status, 202);
  assert.equal(relay.sent.length, 1);
  assert.match(relay.sent[0].body, /https:\/\/shop\.example\.test\/reset\?token=[0-9a-f]{32}/);
});

test('a relay failure answers 503 email_unavailable instead of a false 202', async () => {
  const relay = failingRelay();
  const { app } = withCustomer(relay);
  const res = await app.handle({ method: 'POST', path: '/password-reset', body: { email: 'kim@example.test' } });
  assert.deepEqual(res, { status: 503, body: { error: 'email_unavailable' } });
  assert.equal(relay.attempts.length, 1);
  await sleep(30);
  assert.deepEqual(unhandled, [], 'no promise rejection may escape the request');
});

test('unknown addresses still get 202 and no email, even while the relay is down', async () => {
  const relay = failingRelay();
  const { app } = withCustomer(relay);
  const res = await app.handle({ method: 'POST', path: '/password-reset', body: { email: 'nobody@example.test' } });
  assert.equal(res.status, 202);
  assert.equal(relay.attempts.length, 0);
});

test('the reset link in the email works', async () => {
  const relay = slowRelay(5);
  const { app, user } = withCustomer(relay);
  await app.handle({ method: 'POST', path: '/password-reset', body: { email: 'kim@example.test' } });
  const token = /reset\?token=([0-9a-f]{32})/.exec(relay.sent[0]?.body ?? '')?.[1];
  assert.ok(token, 'reset email sent before the endpoint answered');
  const res = await app.handle({ method: 'POST', path: '/password-reset/confirm', body: { token, password: 'brand new pw 9' } });
  assert.equal(res.status, 200);
  assert.equal(app.users.get(user.id).password, 'brand new pw 9');
});
