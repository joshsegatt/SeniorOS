import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createAccounts } from '../src/accounts.js';

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

test('registers and logs in', () => {
  const accounts = createAccounts();
  const created = accounts.register('ada@example.com', 'correct horse');
  assert.deepEqual(accounts.login('ada@example.com', 'correct horse'), created);
});

test('rejects a wrong password', () => {
  const accounts = createAccounts();
  accounts.register('ada@example.com', 'correct horse');
  assert.equal(accounts.login('ada@example.com', 'wrong horse'), null);
});

test('email is case-insensitive', () => {
  const accounts = createAccounts();
  accounts.register('Ada@Example.com', 'correct horse');
  assert.ok(accounts.login('ada@example.com', 'correct horse'));
});

test('one account per email', () => {
  const accounts = createAccounts();
  accounts.register('ada@example.com', 'correct horse');
  assert.throws(() => accounts.register('ADA@example.com', 'another one'));
});

test('does not store the password itself', () => {
  const accounts = createAccounts();
  accounts.register('ada@example.com', 'correct horse');
  assert.ok(!JSON.stringify(accounts.rows()).includes('correct horse'));
});

test('new passwords use salted scrypt', () => {
  const accounts = createAccounts();
  accounts.register('ada@example.com', 'correct horse');
  accounts.register('bob@example.com', 'correct horse');
  const [a, b] = accounts.rows().map((r) => r.passwordHash);
  assert.match(a, /^scrypt\$/);
  assert.notEqual(a, b);
});

test('existing SHA-256 accounts still log in and are upgraded', () => {
  const accounts = createAccounts([{ id: 'a-1', email: 'ada@example.com', passwordHash: sha256('correct horse') }]);
  assert.equal(accounts.login('ada@example.com', 'wrong horse'), null);
  assert.ok(accounts.login('ada@example.com', 'correct horse'));
  assert.match(accounts.rows()[0].passwordHash, /^scrypt\$/);
  assert.ok(createAccounts(accounts.rows()).login('ada@example.com', 'correct horse'));
});
