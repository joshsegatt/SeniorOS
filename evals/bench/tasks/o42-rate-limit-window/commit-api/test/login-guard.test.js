import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoginGuard } from '../src/auth/login-guard.js';
import { hashPassword } from '../src/auth/passwords.js';

const accounts = new Map([['ops@shop.test', { passwordHash: hashPassword('correct horse'), role: 'admin' }]]);

test('signs in with the right password', () => {
  const guard = createLoginGuard({ accounts, now: () => 60_000 });
  assert.equal(guard.login('Ops@shop.test', 'correct horse').status, 200);
});

test('locks the account after 5 attempts', () => {
  let t = 10_000;
  const guard = createLoginGuard({ accounts, now: () => t });
  for (let i = 0; i < 5; i += 1) {
    t += 30_000;
    assert.equal(guard.login('ops@shop.test', 'wrong').status, 401);
  }
  t += 30_000;
  assert.equal(guard.login('ops@shop.test', 'correct horse').status, 429);
});
