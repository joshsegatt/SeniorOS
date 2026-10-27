import test from 'node:test';
import assert from 'node:assert/strict';
import { lineAmount, orderTotal } from '../../src/orders.js';
import { renderInvoice } from '../../src/invoice.js';

const three = ['a', 'b', 'c'].map((sku) => ({ sku, priceCents: 105, qty: 1 }));
const mixed = [{ sku: 'tea', priceCents: 1999, qty: 2 }, { sku: 'mug', priceCents: 105, qty: 1 }, { sku: 'jam', priceCents: 350, qty: 3 }];

test('the charged total is the sum of the rounded invoice lines (Swiss VAT per line)', () => {
  assert.equal(orderTotal(three, 'CH'), 342);
  assert.equal(orderTotal(mixed, 'CH'), 5571);
});

test('each line is still taxed and rounded on its own', () => {
  assert.equal(lineAmount(three[0], 'CH'), 114);
  assert.deepEqual(mixed.map((l) => lineAmount(l, 'CH')), [4322, 114, 1135]);
});

test('the invoice TOTAL row shows the charged amount', () => {
  assert.match(renderInvoice(three, 'CH'), /TOTAL\s+CHF 3\.42$/);
});

test('single-line orders unchanged', () => {
  assert.equal(orderTotal([{ sku: 'tea', priceCents: 10000, qty: 1 }], 'DE'), 11900);
  assert.equal(orderTotal([{ sku: 'tea', priceCents: 10000, qty: 1 }], 'US'), 10000);
});
