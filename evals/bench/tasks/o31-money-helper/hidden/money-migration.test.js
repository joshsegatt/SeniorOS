import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { savePriceForm } from '../../src/admin/prices.js';
import { importSupplierCosts, margins } from '../../src/import/supplier-costs.js';
import { refund } from '../../src/support/refunds.js';
import { addTip } from '../../src/checkout/tips.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));

test('nothing uses the legacy module any more', () => {
  for (const file of walk(join(root, 'src')).filter((f) => f.endsWith('.js') && !/[\\/]legacy[\\/]money\.js$/.test(f))) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), /legacy\/money|parseAmount/, file);
  }
});

test('the admin price form still saves without a compare-at price', () => {
  const products = new Map([['mug', { name: 'Mug' }]]);
  assert.deepEqual(savePriceForm(products, 'mug', { price: '19.99', compareAt: '' }), { name: 'Mug', priceCents: 1999, compareAtCents: null });
  assert.deepEqual(savePriceForm(products, 'mug', { price: '14.50' }), { name: 'Mug', priceCents: 1450, compareAtCents: null });
  assert.deepEqual(savePriceForm(products, 'mug', { price: '19.99', compareAt: '24.99' }), { name: 'Mug', priceCents: 1999, compareAtCents: 2499 });
});

test("ACME's monthly cost file still imports", () => {
  const csv = readFileSync(join(root, 'data/acme-costs-2026-10.csv'), 'utf8');
  const ids = ['MUG-01', 'MUG-02', 'TEE-S', 'TEE-M', 'CAP-01', 'TOTE-01', 'PIN-01'];
  const products = new Map(ids.map((id) => [id, { priceCents: 1000 }]));
  assert.deepEqual(importSupplierCosts(products, csv), { updated: 7, unknown: [] });
  assert.deepEqual(
    ids.map((id) => products.get(id).costCents),
    [385, 440, 615, 615, 500, 290, 62],
  );
  assert.equal(margins(products)[0].marginCents, 615);
});

test('refunds and tips are unchanged', () => {
  const order = { paidCents: 5000, refundedCents: 0 };
  assert.deepEqual(refund(order, '12.50'), { refundedCents: 1250, remainingCents: 3750 });
  assert.deepEqual(refund(order, '0.5'), { refundedCents: 50, remainingCents: 3700 });
  assert.deepEqual(addTip({ totalCents: 5000 }, 1.5), { totalCents: 5150, tipCents: 150 });
});
