import test from 'node:test';
import assert from 'node:assert/strict';
import { vatFor } from '../src/billing/tax.js';
import { buildInvoice } from '../src/billing/invoices.js';
import { applyCode } from '../src/promotions/discounts.js';
import { pointsFor } from '../src/promotions/loyalty.js';
import { createGoodwillCredit, parseAmountField } from '../src/support/adjustments.js';
import { importSupplierPrices } from '../src/catalog/supplier-prices.js';
import { shippingFor } from '../src/shipping/rates.js';

test('VAT per rate', () => {
  assert.equal(vatFor(1000), 210);
  assert.equal(vatFor(1000, 'reduced'), 90);
  assert.equal(vatFor(1000, 'zero'), 0);
  assert.throws(() => vatFor(1000, 'luxury'), RangeError);
});

test('an invoice sums net and VAT per line and formats the totals', () => {
  const invoice = buildInvoice({
    number: 'INV-2026-0141',
    lines: [
      { description: 'Sencha 100g', quantity: 2, unitCents: 1200 },
      { description: 'Tea book', quantity: 1, unitCents: 2000, vat: 'reduced' },
    ],
  });
  assert.equal(invoice.netCents, 4400);
  assert.equal(invoice.vatCents, 504 + 180);
  assert.deepEqual(invoice.totals, { net: '€44.00', vat: '€6.84', total: '€50.84' });
  assert.equal(invoice.lines[0].net, '€24.00');
});

test('discount codes', () => {
  assert.deepEqual(applyCode(4000, 'welcome10'), { ok: true, discountCents: 400, totalCents: 3600 });
  assert.deepEqual(applyCode(4000, 'NOPE'), { ok: false, error: 'unknown code' });
});

test('loyalty points are whole euros', () => {
  assert.equal(pointsFor(2999), 29);
  assert.equal(pointsFor(0), 0);
});

test('the goodwill credit form accepts the amounts agents type', () => {
  assert.deepEqual(parseAmountField('12,50'), { ok: true, cents: 1250 });
  assert.deepEqual(parseAmountField('€ 5'), { ok: true, cents: 500 });
  assert.deepEqual(parseAmountField('600'), { ok: false, error: 'amount above the goodwill limit' });
  assert.deepEqual(createGoodwillCredit({ customerId: 'c-17', amount: '7.5', reason: ' late parcel ', agent: 'lena' }), {
    ok: true,
    credit: { customerId: 'c-17', cents: 750, reason: 'late parcel', agent: 'lena' },
  });
});

test('supplier prices are stored in cents', () => {
  assert.deepEqual([...importSupplierPrices([{ sku: 'TEA-001', price: 12.5 }, { sku: 'MUG-007', price: '8' }, { sku: 'X', price: '' }])], [['TEA-001', 1250], ['MUG-007', 800]]);
});

test('shipping', () => {
  assert.equal(shippingFor('domestic', 500, 2000), 495);
  assert.equal(shippingFor('domestic', 500, 8000), 0);
  assert.equal(shippingFor('eu', 12000, 8000), 2495);
});
