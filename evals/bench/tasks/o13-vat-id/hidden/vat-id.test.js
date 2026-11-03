import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCustomerRepo } from '../../src/customers/repo.js';
import { createCustomersApi } from '../../src/api/customers.js';
import { createInvoicing } from '../../src/billing/invoices.js';
import { customersCsv } from '../../src/reports/customers-csv.js';
import { importFromAccounting } from '../../src/customers/import.js';

const now = () => new Date('2026-10-15T09:30:00Z');
const body = (extra = {}) => ({ name: 'Keramik Berlin GmbH', email: 'einkauf@keramik.example', phone: '+49 30 1234567', ...extra });

function app(table = []) {
  const repo = createCustomerRepo(table);
  return { table, repo, api: createCustomersApi({ repo, now }), invoicing: createInvoicing({ repo, now }) };
}

/** Minimal RFC 4180 parser for the export. */
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

test('sign-up accepts a VAT ID and stores it compact and upper-case', () => {
  const { api } = app();
  const res = api.handle({ method: 'POST', path: '/customers', body: body({ vatId: 'de 811.907-980' }) });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.vatId, 'DE811907980');
  assert.equal(api.handle({ method: 'GET', path: `/customers/${res.body.id}` }).body.vatId, 'DE811907980');
});

test('the VAT ID is optional, and an invalid one is rejected like an invalid phone', () => {
  const { api } = app();
  const without = api.handle({ method: 'POST', path: '/customers', body: body() });
  assert.equal(without.status, 201);
  assert.equal(without.body.vatId ?? null, null);
  for (const bad of ['DE12', '1234567890', 'DE 123 456 789 012 345', 'D3123456789']) {
    const res = api.handle({ method: 'POST', path: '/customers', body: body({ email: 'other@example.com', vatId: bad }) });
    assert.equal(res.status, 400, `accepted ${bad}`);
    assert.ok(res.body.errors?.vatId, `no vatId error for ${bad}: ${JSON.stringify(res.body)}`);
  }
});

test('customers set, change and clear their VAT ID in account settings', () => {
  const { api } = app();
  const { id } = api.handle({ method: 'POST', path: '/customers', body: body() }).body;
  const set = api.handle({ method: 'PATCH', path: `/customers/${id}`, body: { vatId: 'fr 40 303265045' } });
  assert.equal(set.status, 200, JSON.stringify(set.body));
  assert.equal(set.body.vatId, 'FR40303265045');
  assert.equal(api.handle({ method: 'PATCH', path: `/customers/${id}`, body: { vatId: 'xx' } }).status, 400);
  assert.equal(api.handle({ method: 'GET', path: `/customers/${id}` }).body.vatId, 'FR40303265045');
  const cleared = api.handle({ method: 'PATCH', path: `/customers/${id}`, body: { vatId: null } });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.body.vatId ?? null, null);
  assert.equal(api.handle({ method: 'GET', path: `/customers/${id}` }).body.phone, '+49301234567');
});

test('the VAT ID is persisted: a new repo over the same table reads it back', () => {
  const first = app();
  const { id } = first.api.handle({ method: 'POST', path: '/customers', body: body({ vatId: 'DE811907980' }) }).body;
  const second = app(JSON.parse(JSON.stringify(first.table)));
  assert.equal(second.api.handle({ method: 'GET', path: `/customers/${id}` }).body.vatId, 'DE811907980');
  second.api.handle({ method: 'PATCH', path: `/customers/${id}`, body: { name: 'Keramik Berlin AG' } });
  const third = app(JSON.parse(JSON.stringify(second.table)));
  assert.equal(third.repo.get(id).vatId, 'DE811907980');
});

test('the customer export has a VAT ID column', () => {
  const { api, repo } = app();
  api.handle({ method: 'POST', path: '/customers', body: body({ vatId: 'DE811907980' }) });
  api.handle({ method: 'POST', path: '/customers', body: body({ email: 'ana@example.com', name: 'Ana Lima' }) });
  const [header, ...rows] = parseCsv(customersCsv(repo));
  const col = header.findIndex((h) => /vat/i.test(h));
  assert.ok(col >= 0, `no VAT column in ${header.join(',')}`);
  assert.ok(rows.every((r) => r.length === header.length));
  assert.equal(rows[0][col], 'DE811907980');
  assert.equal(rows[1][col], '');
  assert.equal(rows[0][header.indexOf('phone')], '+49301234567');
});

test('the accounting import brings the VAT number along, normalized', () => {
  const { repo } = app();
  const csv = readFileSync(new URL('../../data/accounting-export-sample.csv', import.meta.url), 'utf8');
  assert.deepEqual(importFromAccounting(csv, repo, now), { imported: 4, skipped: 0 });
  assert.equal(repo.findByEmail('einkauf@keramik-berlin.example')?.vatId, 'DE811907980');
  assert.equal(repo.findByEmail('compta@atelier-rouge.example')?.vatId, 'FR40303265045');
  assert.equal(repo.findByEmail('hello@teacorner.example')?.vatId, 'NL853231469B01');
  assert.equal(repo.findByEmail('ana.lima@example.com')?.vatId ?? null, null);
});

test('invoices print the VAT ID they were issued with', () => {
  const { api, invoicing } = app();
  const { id } = api.handle({ method: 'POST', path: '/customers', body: body({ vatId: 'DE811907980' }) }).body;
  const first = invoicing.issue(id, [{ description: 'Mug', qty: 10, unitCents: 900 }]);
  assert.match(invoicing.render(first.number), /DE811907980/);
  api.handle({ method: 'PATCH', path: `/customers/${id}`, body: { vatId: 'DE999999999' } });
  const second = invoicing.issue(id, [{ description: 'Bowl', qty: 5, unitCents: 1200 }]);
  assert.match(invoicing.render(first.number), /DE811907980/);
  assert.doesNotMatch(invoicing.render(first.number), /DE999999999/);
  assert.match(invoicing.render(second.number), /DE999999999/);
});

test('invoices of customers without a VAT ID print no placeholder', () => {
  const { api, invoicing } = app();
  const { id } = api.handle({ method: 'POST', path: '/customers', body: body() }).body;
  const inv = invoicing.issue(id, [{ description: 'Mug', qty: 1, unitCents: 900 }]);
  assert.doesNotMatch(invoicing.render(inv.number), /undefined|null/);
});
