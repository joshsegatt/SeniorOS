import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInvoice } from '../src/invoice.js';

const ch = { id: 'c-ch', country: 'CH' };

test('line totals and subtotal', () => {
  const invoice = buildInvoice({
    customer: ch,
    lines: [
      { sku: 'CHAIR', qty: 4, unitCents: 1250 },
      { sku: 'LAMP', qty: 1, unitCents: 3999 },
    ],
  });
  assert.deepEqual(invoice.lines.map((line) => line.totalCents), [5000, 3999]);
  assert.equal(invoice.subtotalCents, 8999);
  assert.equal(invoice.discountCents, 0);
});

test('a plain invoice is taxed at the customer rate (docs/invoicing.md example A)', () => {
  const invoice = buildInvoice({ customer: ch, lines: [{ sku: 'DESK', qty: 1, unitCents: 10000 }] });
  assert.equal(invoice.taxCents, 810);
  assert.equal(invoice.totalCents, 10810);
});

test('a fixed coupon lowers the taxable amount (docs/invoicing.md example B)', () => {
  const invoice = buildInvoice({
    customer: ch,
    lines: [{ sku: 'DESK', qty: 2, unitCents: 5000 }],
    coupon: { type: 'fixed', cents: 1000 },
  });
  assert.equal(invoice.totalCents, 9810);
});

test('rejects an invoice without lines or with a bad quantity', () => {
  assert.throws(() => buildInvoice({ customer: ch, lines: [] }), TypeError);
  assert.throws(() => buildInvoice({ customer: ch, lines: [{ sku: 'X', qty: 0, unitCents: 1 }] }), RangeError);
});
