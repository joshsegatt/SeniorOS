import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/crm/store.js';
import { importCustomers, register } from '../src/crm/customers.js';
import { searchCustomers } from '../src/crm/search.js';

const now = () => new Date('2026-10-01T09:00:00Z');

test('register stores a customer and rejects a second sign-up with the same email', () => {
  const store = createStore();
  const c = register(store, { name: 'Ada', email: 'ada@example.com' }, now);
  assert.equal(c.id, 'c1');
  assert.throws(() => register(store, { name: 'Ada again', email: 'ada@example.com' }, now), /already registered/);
});

test('register rejects an invalid email', () => {
  assert.throws(() => register(createStore(), { name: 'X', email: 'nope' }, now), /invalid email/);
});

test('import adds valid rows and skips invalid ones', () => {
  const store = createStore();
  const r = importCustomers(store, [{ name: 'Bob', email: 'bob@example.com' }, { name: 'Bad', email: 'bad' }], now);
  assert.deepEqual(r, { imported: 1, skipped: 1 });
  assert.equal(store.all()[0].source, 'import');
});

test('search by name, case-insensitive, sorted', () => {
  const store = createStore();
  register(store, { name: 'Zoe Silva', email: 'zoe@example.com' }, now);
  register(store, { name: 'Ana Silva', email: 'ana@example.com' }, now);
  assert.deepEqual(searchCustomers(store, 'silva').map((c) => c.name), ['Ana Silva', 'Zoe Silva']);
});

test('search by email', () => {
  const store = createStore();
  register(store, { name: 'Ada', email: 'ada@example.com' }, now);
  assert.equal(searchCustomers(store, 'ada@example.com').length, 1);
  assert.deepEqual(searchCustomers(store, '   '), []);
});
