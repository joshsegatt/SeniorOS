import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInvoice } from '../src/invoice.js';
import { creditNoteFor } from '../src/credit-note.js';

test('a credit note cancels its invoice to the cent', () => {
  const invoice = buildInvoice({
    customer: { id: 'c1', country: 'FR' },
    lines: [{ sku: 'SOFA', qty: 1, unitCents: 45000 }],
  });
  const note = creditNoteFor(invoice);
  assert.equal(invoice.totalCents + note.totalCents, 0);
  assert.equal(invoice.taxCents + note.taxCents, 0);
});
