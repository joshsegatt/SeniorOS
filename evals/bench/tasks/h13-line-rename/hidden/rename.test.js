import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lineAmount, orderTotal } from '../../src/orders.js';
import { renderInvoice } from '../../src/invoice.js';
import { loadOrders, saveOrder } from '../../src/archive.js';
import { monthlyRevenue } from '../../src/report.js';
import { cartTotal } from '../../src/cart.js';

const line = { sku: 'tea', unitPriceCents: 10000, qty: 1 };

test('order lines use unitPriceCents', () => {
  assert.equal(lineAmount(line, 'DE'), 11900);
  assert.equal(orderTotal([line, { sku: 'cake', unitPriceCents: 450, qty: 2 }], 'US'), 10900);
  assert.equal(renderInvoice([line], 'CH'), 'tea        CHF 108.10\nTOTAL      CHF 108.10');
});

/** An archive folder holding orders saved before the rename, as they are on disk. */
function oldArchive() {
  const dir = mkdtempSync(join(tmpdir(), 'archive-'));
  mkdirSync(dir, { recursive: true });
  const old = (id, placedAt, lines) => writeFileSync(join(dir, `${id}.json`), JSON.stringify({ id, region: 'US', placedAt, lines }));
  old('o-0001', '2026-10-02T08:00:00Z', [{ sku: 'tea', priceCents: 1000, qty: 2 }]);
  old('o-0002', '2026-10-09T08:00:00Z', [{ sku: 'cake', priceCents: 450, qty: 1 }, { sku: 'tea', priceCents: 1000, qty: 1 }]);
  return dir;
}

test('orders saved before the rename still count in the monthly revenue', () => {
  assert.equal(monthlyRevenue(oldArchive(), '2026-10'), 3450);
});

test('an order saved before the rename still renders its invoice', () => {
  const [first] = loadOrders(oldArchive());
  assert.equal(renderInvoice(first.lines, 'US'), 'tea        CHF 20.00\nTOTAL      CHF 20.00');
});

test('old and new saved orders add up together', () => {
  const dir = oldArchive();
  saveOrder(dir, { id: 'o-0003', region: 'US', placedAt: '2026-10-20T08:00:00Z', lines: [{ sku: 'tea', unitPriceCents: 1000, qty: 1 }] });
  assert.equal(monthlyRevenue(dir, '2026-10'), 4450);
});

test('cart items, a different type, keep their priceCents field', () => {
  assert.equal(cartTotal([{ sku: 'a', priceCents: 1000, qty: 2 }, { sku: 'b', priceCents: 500, qty: 1 }]), 2500);
  assert.equal(cartTotal([{ sku: 'a', priceCents: 2000, qty: 1 }], { code: 'TEN', percent: 10 }), 1800);
});
