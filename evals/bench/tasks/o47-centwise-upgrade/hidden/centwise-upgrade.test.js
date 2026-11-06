import test from 'node:test';
import assert from 'node:assert/strict';
import { importSupplierPrices } from '../../src/catalog/supplier-prices.js';
import { vatFor } from '../../src/billing/tax.js';
import { buildInvoice } from '../../src/billing/invoices.js';
import { applyCode } from '../../src/promotions/discounts.js';
import { pointsFor } from '../../src/promotions/loyalty.js';
import { createGoodwillCredit, parseAmountField } from '../../src/support/adjustments.js';

test('the reported bug: supplier prices no longer lose a cent', () => {
  assert.deepEqual([...importSupplierPrices([{ sku: 'TEA-001', price: 19.99 }, { sku: 'TEA-002', price: 0.29 }, { sku: 'TEA-003', price: '4.35' }])], [
    ['TEA-001', 1999],
    ['TEA-002', 29],
    ['TEA-003', 435],
  ]);
});

test('VAT on half a cent still rounds up, as on every invoice issued so far', () => {
  assert.equal(vatFor(250), 53); // 52.5
  assert.equal(vatFor(50), 11); // 10.5
  assert.equal(vatFor(50, 'reduced'), 5); // 4.5
  const invoice = buildInvoice({ number: 'INV-2026-0142', lines: [{ description: 'Tea sample', quantity: 1, unitCents: 250 }] });
  assert.equal(invoice.vatCents, 53);
  assert.deepEqual(invoice.totals, { net: '€2.50', vat: '€0.53', total: '€3.03' });
});

test('discounts on half a cent still round up', () => {
  assert.deepEqual(applyCode(1625, 'WELCOME10'), { ok: true, discountCents: 163, totalCents: 1462 }); // 162.5
  assert.deepEqual(applyCode(1250, 'STAFF30'), { ok: true, discountCents: 375, totalCents: 875 });
});

test('loyalty points are unchanged', () => {
  assert.equal(pointsFor(2999), 29);
  assert.equal(pointsFor(2950), 29);
});

test('the goodwill credit form still answers a typo with a form error', () => {
  assert.deepEqual(parseAmountField('abc'), { ok: false, error: 'invalid amount' });
  assert.deepEqual(parseAmountField(''), { ok: false, error: 'invalid amount' });
  assert.deepEqual(parseAmountField('12.505'), { ok: false, error: 'invalid amount' });
  assert.deepEqual(createGoodwillCredit({ customerId: 'c-17', amount: 'twelve', reason: 'late parcel', agent: 'lena' }), { ok: false, field: 'amount', error: 'invalid amount' });
  assert.deepEqual(parseAmountField('12,50'), { ok: true, cents: 1250 });
});
