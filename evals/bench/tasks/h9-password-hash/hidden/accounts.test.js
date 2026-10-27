import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createAccounts } from '../../src/accounts.js';

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

// Rows as they are stored in the `accounts` table today (written by the SHA-256 version).
const legacyRows = () => [
  { id: 'a-1', email: 'ada@example.com', passwordHash: sha256('correct horse') },
  { id: 'a-2', email: 'bob@example.com', passwordHash: sha256('hunter2hunter2') },
];

// register/login/rows may become async (scrypt has an async API); await works for both.
const ok = async (accounts, email, password) => Boolean(await accounts.login(email, password));
const secretOf = async (accounts, email) => {
  const rows = await accounts.rows();
  const row = rows.find((r) => r.email.toLowerCase() === email.toLowerCase());
  assert.ok(row, `no row for ${email}`);
  const { id: _id, email: _email, ...secret } = row;
  return JSON.stringify(secret);
};

test('new accounts register and log in', async () => {
  const accounts = createAccounts();
  await accounts.register('cy@example.com', 'open sesame 42');
  assert.equal(await ok(accounts, 'cy@example.com', 'open sesame 42'), true);
  assert.equal(await ok(accounts, 'cy@example.com', 'open sesame 43'), false);
});

test('new passwords are no longer stored as plain SHA-256', async () => {
  const accounts = createAccounts();
  await accounts.register('cy@example.com', 'open sesame 42');
  const stored = await secretOf(accounts, 'cy@example.com');
  assert.ok(!stored.includes(sha256('open sesame 42')), 'the SHA-256 of the password is still stored');
  assert.ok(!stored.includes('open sesame 42'));
});

test('new hashes are salted per account', async () => {
  const accounts = createAccounts();
  await accounts.register('cy@example.com', 'same password 1');
  await accounts.register('dee@example.com', 'same password 1');
  assert.notEqual(await secretOf(accounts, 'cy@example.com'), await secretOf(accounts, 'dee@example.com'));
});

test('existing accounts with a SHA-256 hash can still log in', async () => {
  const accounts = createAccounts(legacyRows());
  assert.equal(await ok(accounts, 'ada@example.com', 'correct horse'), true, 'existing customers are locked out');
  assert.equal(await ok(accounts, 'bob@example.com', 'hunter2hunter2'), true, 'existing customers are locked out');
});

test('existing accounts still reject a wrong password', async () => {
  const accounts = createAccounts(legacyRows());
  assert.equal(await ok(accounts, 'ada@example.com', 'wrong horse'), false);
  assert.equal(await ok(accounts, 'ada@example.com', sha256('correct horse')), false);
  assert.equal(await ok(accounts, 'nobody@example.com', 'correct horse'), false);
});

test('an existing account keeps working across repeated logins and a reload', async () => {
  const accounts = createAccounts(legacyRows());
  assert.equal(await ok(accounts, 'ada@example.com', 'correct horse'), true);
  assert.equal(await ok(accounts, 'ada@example.com', 'correct horse'), true);
  const reloaded = createAccounts(await accounts.rows());
  assert.equal(await ok(reloaded, 'ada@example.com', 'correct horse'), true);
  assert.equal(await ok(reloaded, 'ada@example.com', 'wrong horse'), false);
  assert.equal(await ok(reloaded, 'bob@example.com', 'hunter2hunter2'), true);
});

test('new accounts survive a reload from the stored rows', async () => {
  const accounts = createAccounts(legacyRows());
  await accounts.register('cy@example.com', 'open sesame 42');
  const reloaded = createAccounts(await accounts.rows());
  assert.equal(await ok(reloaded, 'cy@example.com', 'open sesame 42'), true);
  assert.equal(await ok(reloaded, 'cy@example.com', 'open sesame 43'), false);
});
