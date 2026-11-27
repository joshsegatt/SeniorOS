import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInvoice } from '../src/invoice.js';
import { statementFor, vatReport } from '../src/statement.js';
import { createCustomerStore } from '../src/customers.js';

const customers = createCustomerStore([
  { id: 'c1', country: 'CH' },
  { id: 'c2', country: 'DE' },
]);

const invoices = [
  buildInvoice({ customer: customers.get('c1'), lines: [{ sku: 'A', qty: 1, unitCents: 10000 }] }),
  buildInvoice({ customer: customers.get('c1'), lines: [{ sku: 'B', qty: 1, unitCents: 2000 }] }),
  buildInvoice({ customer: customers.get('c2'), lines: [{ sku: 'C', qty: 1, unitCents: 1000 }] }),
];

test('statement sums the customer invoices only', () => {
  assert.deepEqual(statementFor('c1', invoices), { customerId: 'c1', documentCount: 2, totalCents: 12972 });
});

test('VAT report groups by country', () => {
  assert.deepEqual(vatReport(invoices), {
    CH: { taxableCents: 12000, taxCents: 972 },
    DE: { taxableCents: 1000, taxCents: 190 },
  });
});
