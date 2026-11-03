import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { customerInput, makeApp } from './factories.js';
import { validateCustomer } from '../src/customers/model.js';
import { customersCsv } from '../src/reports/customers-csv.js';
import { importFromAccounting } from '../src/customers/import.js';

test('creating a customer normalizes email and phone', () => {
  const { api } = makeApp();
  const res = api.handle({ method: 'POST', path: '/customers', body: customerInput({ email: ' Ada@Example.com ' }) });
  assert.equal(res.status, 201);
  assert.deepEqual(res.body, { id: 'cus_1', name: 'Ada Lovelace', email: 'ada@example.com', phone: '+442079460000', vatId: null, createdAt: '2026-10-15T09:30:00.000Z' });
  assert.equal(api.handle({ method: 'POST', path: '/customers', body: customerInput() }).status, 409);
});

test('invalid input is rejected field by field', () => {
  const { api } = makeApp();
  const res = api.handle({ method: 'POST', path: '/customers', body: { name: '', email: 'nope', phone: '12' } });
  assert.equal(res.status, 400);
  assert.deepEqual(res.body.errors, { name: 'name is required', email: 'invalid email', phone: 'invalid phone' });
  assert.deepEqual(validateCustomer({ name: 'X', email: 'x@y.zz' }), { ok: true, value: { name: 'X', email: 'x@y.zz', phone: null, vatId: null } });
});

test('customers edit their name and phone, and can clear the phone', () => {
  const { api } = makeApp();
  api.handle({ method: 'POST', path: '/customers', body: customerInput() });
  assert.equal(api.handle({ method: 'PATCH', path: '/customers/cus_1', body: { phone: '(+351) 912-345-678' } }).body.phone, '+351912345678');
  assert.equal(api.handle({ method: 'PATCH', path: '/customers/cus_1', body: { phone: null } }).body.phone, null);
  assert.equal(api.handle({ method: 'PATCH', path: '/customers/cus_1', body: { email: 'x@y.zz' } }).status, 400);
  assert.equal(api.handle({ method: 'PATCH', path: '/customers/cus_1', body: { phone: 'abc' } }).status, 400);
  assert.equal(api.handle({ method: 'GET', path: '/customers/cus_9' }).status, 404);
});

test('what was stored is read back by a new repo over the same table', () => {
  const first = makeApp();
  first.api.handle({ method: 'POST', path: '/customers', body: customerInput() });
  assert.equal(first.table[0].phone_number, '+442079460000');
  const second = makeApp(first.table);
  assert.equal(second.api.handle({ method: 'GET', path: '/customers/cus_1' }).body.phone, '+442079460000');
});

test('the CSV export', () => {
  const { api, repo } = makeApp();
  api.handle({ method: 'POST', path: '/customers', body: customerInput({ name: 'Lovelace, Ada' }) });
  api.handle({ method: 'POST', path: '/customers', body: customerInput({ email: 'bob@example.com', name: 'Bob', phone: null }) });
  assert.equal(customersCsv(repo), 'id,name,email,phone,vat_id,created_at\ncus_1,"Lovelace, Ada",ada@example.com,+442079460000,,2026-10-15\ncus_2,Bob,bob@example.com,,,2026-10-15\n');
});

test('the accounting import', () => {
  const { repo } = makeApp();
  const csv = readFileSync(new URL('../data/accounting-export-sample.csv', import.meta.url), 'utf8');
  assert.deepEqual(importFromAccounting(csv, repo), { imported: 4, skipped: 0 });
  assert.equal(repo.findByEmail('ana.lima@example.com')?.phone, '912345678');
  assert.equal(repo.findByEmail('compta@atelier-rouge.example')?.phone, null);
  assert.deepEqual(importFromAccounting(csv, repo), { imported: 0, skipped: 4 });
});

test('invoices copy the billing details when issued', () => {
  const { api, invoicing } = makeApp();
  api.handle({ method: 'POST', path: '/customers', body: customerInput() });
  const inv = invoicing.issue('cus_1', [{ description: 'Mug', qty: 2, unitCents: 1250 }]);
  assert.equal(inv.number, 'INV-0001');
  api.handle({ method: 'PATCH', path: '/customers/cus_1', body: { name: 'Ada King' } });
  const text = invoicing.render('INV-0001');
  assert.match(text, /Bill to:\n {2}Ada Lovelace\n {2}ada@example.com/);
  assert.match(text, /Total EUR\s+25\.00$/);
});
