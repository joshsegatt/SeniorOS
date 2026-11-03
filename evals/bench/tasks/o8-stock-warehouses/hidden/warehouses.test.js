import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stockReport } from '../../src/stock/report.js';
import { loadInventory } from '../../src/stock/inventory.js';
import { reorderMessage } from '../../plugins/reorder-bot/index.js';
import { stockWidget } from '../../plugins/dashboard/stock-widget.js';

const CLI = fileURLToPath(new URL('../../bin/stock-report.js', import.meta.url));
const now = () => new Date('2026-10-20T06:00:00Z');

test('the report has one entry per warehouse, sorted by id, with its items and low-stock count', () => {
  const report = stockReport(loadInventory(), { now });
  assert.ok(Array.isArray(report.warehouses), 'warehouses list');
  assert.deepEqual(
    report.warehouses.map((w) => ({ id: w.id, skus: w.items.map((i) => i.sku), lowStock: w.lowStock })),
    [
      { id: 'BSL', skus: ['cup-set', 'pot-glass', 'tea-green'], lowStock: 2 },
      { id: 'GVA', skus: ['kettle'], lowStock: 1 },
      { id: 'ZRH', skus: ['tea-black', 'tea-green'], lowStock: 1 },
    ],
  );
  const bsl = report.warehouses[0].items.find((i) => i.sku === 'tea-green');
  assert.equal(bsl.qty, 5);
});

test('the CLI --json output carries the warehouses', () => {
  const json = JSON.parse(execFileSync(process.execPath, [CLI, '--json'], { encoding: 'utf8' }));
  assert.deepEqual(json.warehouses.map((w) => w.id), ['BSL', 'GVA', 'ZRH']);
  assert.equal(json.warehouses[0].lowStock, 2);
});

test('the reorder bot, which reads the CLI JSON, still lists what to reorder', () => {
  assert.equal(
    reorderMessage(),
    [
      'Please reorder:',
      '- Kettle (kettle) in GVA: 0 left, reorder point 2',
      '- Glass teapot (pot-glass) in BSL: 3 left, reorder point 5',
      '- Black tea (tea-black) in ZRH: 8 left, reorder point 20',
      '- Green tea (tea-green) in BSL: 5 left, reorder point 10',
    ].join('\n'),
  );
});

test('the dashboard tile still shows the low-stock total', () => {
  assert.deepEqual(stockWidget(stockReport(loadInventory(), { now })), {
    title: 'Stock',
    value: 4,
    caption: '4 low on stock (as of 06:00 UTC)',
    tone: 'warn',
  });
});

test('the terminal output still works', () => {
  const text = execFileSync(process.execPath, [CLI], { encoding: 'utf8' });
  for (const sku of ['cup-set', 'kettle', 'pot-glass', 'tea-black', 'tea-green']) assert.ok(text.includes(sku), sku);
});
