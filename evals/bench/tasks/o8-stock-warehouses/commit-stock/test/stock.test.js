import test from 'node:test';
import assert from 'node:assert/strict';
import { formatReport, stockReport } from '../src/stock/report.js';

const now = () => new Date('2026-10-20T06:00:00Z');
const inventory = [
  { sku: 'tea', name: 'Tea', warehouse: 'ZRH', qty: 8, reorderAt: 10 },
  { sku: 'cup', name: 'Cup', warehouse: 'BSL', qty: 30, reorderAt: 5 },
];

test('flags items at or below the reorder point', () => {
  const report = stockReport(inventory, { now });
  assert.equal(report.generatedAt, '2026-10-20T06:00:00.000Z');
  assert.deepEqual(report.items.map((i) => [i.sku, i.low]), [['cup', false], ['tea', true]]);
  assert.equal(report.lowStock, 1);
});

test('text report ends with the low-stock count', () => {
  const text = formatReport(stockReport(inventory, { now }));
  assert.match(text, /! tea/);
  assert.match(text.split('\n').at(-1), /^1 item\(s\)/);
});
