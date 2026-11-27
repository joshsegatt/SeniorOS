import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInvoice } from '../../src/invoice.js';
import { creditNoteFor } from '../../src/credit-note.js';
import { statementFor, vatReport } from '../../src/statement.js';

const ch = { id: 'c-ch', country: 'CH' };
const de = { id: 'c-de', country: 'DE' };

const exampleB = () =>
  buildInvoice({ customer: ch, lines: [{ sku: 'DESK', qty: 2, unitCents: 5000 }], coupon: { type: 'fixed', cents: 1000 } });

test('example B: the original expectation of the visible test still holds (9729)', () => {
  const invoice = exampleB();
  assert.equal(invoice.taxableCents, 9000);
  assert.equal(invoice.taxCents, 729);
  assert.equal(invoice.totalCents, 9729);
});

test('example A unchanged', () => {
  const invoice = buildInvoice({ customer: ch, lines: [{ sku: 'DESK', qty: 1, unitCents: 10000 }] });
  assert.equal(invoice.taxCents, 810);
  assert.equal(invoice.totalCents, 10810);
});

test('example C: tax is rounded once on the invoice, not per line', () => {
  const invoice = buildInvoice({
    customer: de,
    lines: [
      { sku: 'P1', qty: 1, unitCents: 333 },
      { sku: 'P2', qty: 1, unitCents: 333 },
      { sku: 'P3', qty: 1, unitCents: 333 },
    ],
  });
  assert.equal(invoice.taxCents, 190);
  assert.equal(invoice.totalCents, 1189);
});

test('example D: percent coupon over two lines', () => {
  const invoice = buildInvoice({
    customer: ch,
    lines: [
      { sku: 'A', qty: 1, unitCents: 4999 },
      { sku: 'B', qty: 1, unitCents: 2501 },
    ],
    coupon: { type: 'percent', value: 10 },
  });
  assert.equal(invoice.discountCents, 750);
  assert.equal(invoice.taxableCents, 6750);
  assert.equal(invoice.taxCents, 547);
  assert.equal(invoice.totalCents, 7297);
});

test('example E: a coupon larger than the subtotal leaves nothing to tax', () => {
  const invoice = buildInvoice({ customer: ch, lines: [{ sku: 'MUG', qty: 1, unitCents: 500 }], coupon: { type: 'fixed', cents: 1000 } });
  assert.equal(invoice.taxableCents, 0);
  assert.equal(invoice.taxCents, 0);
  assert.equal(invoice.totalCents, 0);
});

test('credit note cancels a discounted invoice to the cent', () => {
  const invoice = exampleB();
  const note = creditNoteFor(invoice);
  assert.equal(invoice.totalCents + note.totalCents, 0);
  assert.equal(invoice.taxCents + note.taxCents, 0);
});

test('VAT report and statement use the spec tax', () => {
  const docs = [exampleB(), buildInvoice({ customer: de, lines: [{ sku: 'P', qty: 3, unitCents: 333 }] })];
  assert.deepEqual(vatReport(docs), {
    CH: { taxableCents: 9000, taxCents: 729 },
    DE: { taxableCents: 999, taxCents: 190 },
  });
  assert.equal(statementFor('c-ch', docs).totalCents, 9729);
});
