import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadOrders, saveOrder } from '../src/archive.js';
import { monthlyRevenue } from '../src/report.js';

test('a saved order loads back', () => {
  const dir = mkdtempSync(join(tmpdir(), 'archive-'));
  const order = { id: 'o1', region: 'US', placedAt: '2026-10-01T10:00:00Z', lines: [{ sku: 'tea', priceCents: 500, qty: 1 }] };
  saveOrder(dir, order);
  assert.deepEqual(loadOrders(dir), [order]);
});

test('monthly revenue sums the orders of that month', () => {
  const dir = mkdtempSync(join(tmpdir(), 'archive-'));
  saveOrder(dir, { id: 'o1', region: 'US', placedAt: '2026-10-01T10:00:00Z', lines: [{ sku: 'tea', priceCents: 500, qty: 2 }] });
  saveOrder(dir, { id: 'o2', region: 'US', placedAt: '2026-11-01T10:00:00Z', lines: [{ sku: 'tea', priceCents: 500, qty: 1 }] });
  assert.equal(monthlyRevenue(dir, '2026-10'), 1000);
});
