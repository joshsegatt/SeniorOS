import test from 'node:test';
import assert from 'node:assert/strict';
import { ordersCsv } from '../../src/exports/orders.js';
import { accountingCsv } from '../../src/exports/accounting.js';
import { supplierStock, lowStock } from '../../src/imports/supplier-stock.js';
import { readPriceUpdate, applyPriceUpdate } from '../../src/catalog/price-update.js';
import { importCustomers } from '../../src/imports/customers.js';

test('the advisory: a customer note that is a formula is escaped in the orders export', () => {
  const csv = ordersCsv([
    { id: 'o-2001', placedAt: '2026-10-05T08:00:00Z', customerEmail: 'eve@example.test', totalCents: 990, note: '=1+2' },
    { id: 'o-2002', placedAt: '2026-10-05T09:00:00Z', customerEmail: 'eve@example.test', totalCents: 990, note: '@SUM(A1:A9)' },
  ]);
  const lines = csv.trimEnd().split('\n');
  assert.equal(lines[1], "o-2001,2026-10-05,eve@example.test,9.90,'=1+2");
  assert.equal(lines[2], "o-2002,2026-10-05,eve@example.test,9.90,'@SUM(A1:A9)");
});

test('the accounting journal stays semicolon-separated with decimal commas', () => {
  const csv = accountingCsv([
    { date: '2026-10-02', kind: 'sale', reference: 'o-1042', amountCents: 2490 },
    { date: '2026-10-03', kind: 'refund', reference: 'o-1042', amountCents: 1205 },
  ]);
  assert.equal(csv, 'date;account;description;amount\n2026-10-02;8000;Order o-1042;24,90\n2026-10-03;8010;Refund o-1042;-12,05\n');
});

test('the supplier stock file is still read as semicolon-separated, with quantities summed per SKU', () => {
  const text = 'sku;bin;qty\nTEA-001;A1;10\nTEA-001;B4;2\nMUG-007;A2;3\n';
  assert.deepEqual([...supplierStock(text)], [['TEA-001', 12], ['MUG-007', 3]]);
  assert.deepEqual(lowStock(text, 5), ['MUG-007']);
});

test('price update sheets still accept whole-cent prices', () => {
  const text = 'sku,priceCents\nTEA-001,1290\nMUG-007,0\nPOT-002,12.5\n';
  assert.deepEqual(readPriceUpdate(text), {
    updates: [{ sku: 'TEA-001', priceCents: 1290 }],
    rejected: [{ line: 3, sku: 'MUG-007' }, { line: 4, sku: 'POT-002' }],
  });
  const catalog = new Map([['TEA-001', { priceCents: 1190 }]]);
  assert.deepEqual(applyPriceUpdate(catalog, 'sku,priceCents\nTEA-001,1290\n'), { applied: 1, rejected: [], unknown: [] });
  assert.equal(catalog.get('TEA-001').priceCents, 1290);
});

test('customer upload is unchanged', () => {
  assert.deepEqual(importCustomers('email,name,newsletter\nAda@Example.test,Ada,yes\n').customers, [{ email: 'ada@example.test', name: 'Ada', newsletter: true }]);
});
