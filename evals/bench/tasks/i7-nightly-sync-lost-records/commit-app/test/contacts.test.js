import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeContact, mergeContact } from '../src/contacts.js';

test('normalizeContact trims and lowercases', () => {
  const c = normalizeContact({ id: 7, name: ' Ana ', email: ' Ana@X.CH ', updatedAt: '2026-11-01T10:00:00Z' });
  assert.deepEqual(c, { id: '7', name: 'Ana', email: 'ana@x.ch', updatedAt: '2026-11-01T10:00:00.000Z' });
});

test('mergeContact keeps the latest version', () => {
  const old = { id: '1', updatedAt: '2026-01-01T00:00:00.000Z' };
  const fresh = { id: '1', updatedAt: '2026-02-01T00:00:00.000Z' };
  assert.equal(mergeContact(old, fresh), fresh);
  assert.equal(mergeContact(fresh, old), fresh);
  assert.equal(mergeContact(undefined, old), old);
});
