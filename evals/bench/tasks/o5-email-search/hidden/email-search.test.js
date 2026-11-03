import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../../src/crm/store.js';
import { importCustomers, register } from '../../src/crm/customers.js';
import { searchCustomers } from '../../src/crm/search.js';

const now = () => new Date('2026-10-01T09:00:00Z');

function storeWithImportedAna() {
  const store = createStore();
  importCustomers(store, [{ name: 'Ana Silva', email: ' Ana.Silva@Example.com ' }, { name: 'Bob', email: 'bob@example.com' }], now);
  return store;
}

test('the reported case: support search finds an imported customer by her email in any case', () => {
  const found = searchCustomers(storeWithImportedAna(), 'ana.silva@example.com');
  assert.deepEqual(found.map((c) => c.name), ['Ana Silva']);
});

test('sign-in and password reset find an imported customer by email', () => {
  const store = storeWithImportedAna();
  assert.equal(store.findByEmail('ana.silva@example.com')?.name, 'Ana Silva');
  assert.equal(store.findByEmail('Ana.Silva@Example.com')?.name, 'Ana Silva');
});

test('signing up again with an imported email is rejected as a duplicate', () => {
  const store = storeWithImportedAna();
  assert.throws(() => register(store, { name: 'Ana', email: 'ANA.SILVA@example.com' }, now), /already registered/);
  assert.equal(store.all().length, 2);
});

test('the import does not create two customers for the same email written differently', () => {
  const store = createStore();
  const r = importCustomers(store, [
    { name: 'Carla', email: 'Carla@Example.com' },
    { name: 'Carla M.', email: 'carla@example.com ' },
  ], now);
  assert.deepEqual(r, { imported: 1, skipped: 1 });
  assert.equal(store.all().length, 1);
});

test('an imported customer is not imported twice when the old shop export is run again', () => {
  const store = storeWithImportedAna();
  const r = importCustomers(store, [{ name: 'Ana Silva', email: 'Ana.Silva@Example.com' }], now);
  assert.deepEqual(r, { imported: 0, skipped: 1 });
});

test('search keeps working for signed-up customers and by name', () => {
  const store = storeWithImportedAna();
  register(store, { name: 'Dora', email: 'dora@example.com' }, now);
  assert.deepEqual(searchCustomers(store, 'DORA@example.com').map((c) => c.name), ['Dora']);
  assert.deepEqual(searchCustomers(store, 'silva').map((c) => c.name), ['Ana Silva']);
});
