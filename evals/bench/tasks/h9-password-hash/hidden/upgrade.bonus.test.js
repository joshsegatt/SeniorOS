import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createAccounts } from '../../src/accounts.js';

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

// Bonus (not required to pass): a successful login upgrades the legacy hash, so SHA-256 hashes disappear over time.
test('a successful login replaces the SHA-256 hash', async () => {
  const accounts = createAccounts([{ id: 'a-1', email: 'ada@example.com', passwordHash: sha256('correct horse') }]);
  assert.ok(await accounts.login('ada@example.com', 'correct horse'));
  const rows = await accounts.rows();
  assert.ok(!JSON.stringify(rows).includes(sha256('correct horse')));
  assert.ok(await createAccounts(rows).login('ada@example.com', 'correct horse'));
});
