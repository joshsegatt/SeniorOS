import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccounts, hashPassword, verifyPassword } from '../src/accounts.js';

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

test('hashes with a random salt', () => {
  const a = hashPassword('correct horse');
  const b = hashPassword('correct horse');
  assert.notEqual(a, b);
  assert.ok(verifyPassword('correct horse', a));
  assert.ok(verifyPassword('correct horse', b));
  assert.ok(!verifyPassword('wrong horse', a));
});
