import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCustomer } from '../src/customers/customerForm.js';
import { createCustomerStore } from '../src/customers/customerStore.js';
import { ValidationError } from '../src/errors.js';

const base = { name: 'Boulangerie Rochat', email: 'compta@rochat.ch', country: 'CH', postalCode: '1003' };

test('a complete customer is valid', () => {
  assert.deepEqual(validateCustomer(base), { ok: true, errors: {} });
});

test('missing fields are required', () => {
  assert.deepEqual(validateCustomer({}).errors, {
    name: 'required',
    email: 'required',
    country: 'required',
    postalCode: 'required',
  });
});

test('obviously bad email is invalid', () => {
  assert.equal(validateCustomer({ ...base, email: 'not-an-email' }).errors.email, 'invalid');
});

test('store rejects invalid customers and normalises email', () => {
  const store = createCustomerStore();
  assert.throws(() => store.add({ ...base, country: 'ES' }), ValidationError);
  assert.equal(store.add({ ...base, email: 'Compta@Rochat.ch' }).email, 'compta@rochat.ch');
});
