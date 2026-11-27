import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncContacts, CONTACTS_KEY } from '../src/sync.js';
import { MemoryStore } from '../src/store.js';
import { InMemoryRemote } from '../src/remote.js';
import { makeContacts, waitFor } from './helpers.js';

test('nightly sync imports every contact from the remote', { timeout: 30_000 }, async () => {
  const remote = new InMemoryRemote(makeContacts(120), {
    pageSize: 25,
    delay: () => Math.floor(Math.random() * 10),
  });
  const store = new MemoryStore();

  await syncContacts({ remote, store });

  await waitFor(async () => Object.keys((await store.load(CONTACTS_KEY)) ?? {}).length === 120, {
    timeout: 30_000,
  });
  const doc = await store.load(CONTACTS_KEY);
  assert.equal(doc.c7.email, 'contact7@example.com');
  assert.equal(doc.c7.name, 'Contact 7');
});
