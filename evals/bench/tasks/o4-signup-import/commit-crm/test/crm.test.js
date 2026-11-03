import test from 'node:test';
import assert from 'node:assert/strict';
import { createCustomerStore, DuplicateEmail, normalizeEmail } from '../src/crm/customers.js';
import { demoCustomers } from '../src/crm/seed.js';

const ada = { id: 'cu-1', email: 'Ada@Example.com', name: 'Ada', kind: 'customer', newsletter: false };

test('emails are matched trimmed and case-insensitively', () => {
  assert.equal(normalizeEmail('  Ada@Example.COM '), 'ada@example.com');
  const store = createCustomerStore([ada]);
  assert.equal(store.findByEmail(' ada@example.com')?.id, 'cu-1');
  assert.equal(store.findByEmail('bob@example.com'), null);
});

test('add assigns an id and refuses duplicate emails', () => {
  const store = createCustomerStore([ada]);
  const lead = store.add({ email: ' lee@post.ch ', name: 'Lee', kind: 'lead', newsletter: true });
  assert.equal(lead.id, 'cu-2');
  assert.equal(lead.email, 'lee@post.ch');
  assert.throws(() => store.add({ email: 'ADA@example.com', name: 'Ada 2', kind: 'lead', newsletter: true }), DuplicateEmail);
  assert.equal(store.size, 2);
});

test('update patches a record', () => {
  const store = createCustomerStore([ada]);
  store.update('cu-1', { newsletter: true });
  assert.equal(store.findByEmail('ada@example.com')?.newsletter, true);
});

test('demo data has unique emails', () => {
  const rows = demoCustomers(500);
  assert.equal(new Set(rows.map((r) => r.email)).size, 500);
});
