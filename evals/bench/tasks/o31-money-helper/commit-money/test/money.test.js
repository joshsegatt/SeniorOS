import test from 'node:test';
import assert from 'node:assert/strict';
import { toCents, formatCents } from '../src/lib/money.js';
import { savePriceForm } from '../src/admin/prices.js';
import { importSupplierCosts, margins } from '../src/import/supplier-costs.js';
import { refund } from '../src/support/refunds.js';
import { addTip } from '../src/checkout/tips.js';

test('toCents is exact', () => {
  assert.equal(toCents('19.99'), 1999);
  assert.equal(toCents('0.1'), 10);
  assert.equal(toCents('-5'), -500);
  assert.equal(toCents(1.15), 115);
  assert.throws(() => toCents('abc'), TypeError);
  assert.equal(formatCents(1999), '€19.99');
});

test('the admin price form', () => {
  const products = new Map([['mug', { name: 'Mug' }]]);
  assert.deepEqual(savePriceForm(products, 'mug', { price: '19.99', compareAt: '24.99' }), { name: 'Mug', priceCents: 1999, compareAtCents: 2499 });
  assert.throws(() => savePriceForm(products, 'mug', { price: '19.99', compareAt: '9.99' }), RangeError);
});

test('supplier costs are applied and give margins', () => {
  const products = new Map([['MUG-01', { priceCents: 1200 }], ['CAP-01', { priceCents: 1800 }]]);
  const result = importSupplierCosts(products, 'sku;cost\nMUG-01;3.85\nCAP-01;5\nOLD-9;1.00\n');
  assert.deepEqual(result, { updated: 2, unknown: ['OLD-9'] });
  assert.deepEqual(margins(products), [{ id: 'MUG-01', marginCents: 815 }, { id: 'CAP-01', marginCents: 1300 }]);
});

test('support refunds and checkout tips', () => {
  const order = { paidCents: 5000, refundedCents: 0 };
  assert.deepEqual(refund(order, '12.50'), { refundedCents: 1250, remainingCents: 3750 });
  assert.throws(() => refund(order, '40'), RangeError);
  assert.deepEqual(addTip({ totalCents: 5000 }, 2), { totalCents: 5200, tipCents: 200 });
});
