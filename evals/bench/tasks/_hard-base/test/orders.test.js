import test from 'node:test';
import assert from 'node:assert/strict';
import { lineAmount, orderTotal } from '../src/orders.js';
import { renderInvoice } from '../src/invoice.js';

test('a single line includes tax', () => {
  assert.equal(lineAmount({ sku: 'tea', priceCents: 10000, qty: 1 }, 'DE'), 11900);
});

test('order total of one line', () => {
  assert.equal(orderTotal([{ sku: 'tea', priceCents: 10000, qty: 1 }], 'CH'), 10810);
});

test('renders an invoice', () => {
  assert.equal(renderInvoice([{ sku: 'tea', priceCents: 10000, qty: 1 }], 'CH'), 'tea        CHF 108.10\nTOTAL      CHF 108.10');
});
