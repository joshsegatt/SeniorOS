import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { createAccountApp } from '../../src/account/app.js';

const auditFile = () => join(mkdtempSync(join(tmpdir(), 'hidden-verify-')), 'audit.log');

test('the verification resend has the same defect: answers only after the relay accepted the email', async () => {
  const sent = [];
  const app = createAccountApp({ transport: { async send(m) { await sleep(40); sent.push(m); } }, auditFile: auditFile() });
  const user = app.users.add({ email: 'max@example.test', name: 'Max', password: 'whatever pw 1', verified: false });
  const res = await app.handle({ method: 'POST', path: '/verification/resend', body: { userId: user.id } });
  assert.equal(res.status, 202);
  assert.equal(sent.length, 1);
});

test('the verification resend answers 503 when the relay is down', async () => {
  const app = createAccountApp({ transport: { async send() { throw new Error('421 relay unavailable'); } }, auditFile: auditFile() });
  const user = app.users.add({ email: 'max@example.test', name: 'Max', password: 'whatever pw 1', verified: false });
  const res = await app.handle({ method: 'POST', path: '/verification/resend', body: { userId: user.id } });
  assert.deepEqual(res, { status: 503, body: { error: 'email_unavailable' } });
});
