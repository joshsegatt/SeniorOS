import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderStore } from '../src/orders/store.js';
import { orderHistory } from '../src/orders/history.js';
import { applyCredit } from '../src/billing/credits.js';
import { buyAgain } from '../src/marketing/reorder.js';

const order = (id, placedAt, extra = {}) => ({
  id,
  customerId: 'c1',
  placedAt,
  totalCents: 1000,
  balanceCents: 0,
  status: 'paid',
  lines: [{ sku: 'mug', qty: 1, priceCents: 1000 }],
  ...extra,
});

test('order history lists the customer orders', () => {
  const store = createOrderStore([
    order('o1', '2026-03-01T10:00:00Z'),
    order('o2', '2026-05-01T10:00:00Z'),
    { ...order('x1', '2026-04-01T10:00:00Z'), customerId: 'c2' },
  ]);
  const page = orderHistory(store, 'c1');
  assert.equal(page.pages, 1);
  assert.deepEqual(page.rows.map((r) => r.id), ['o2', 'o1']);
  assert.equal(page.rows[0].date, '2026-05-01');
});

test('order history is paginated by 10', () => {
  const store = createOrderStore(Array.from({ length: 12 }, (_, i) => order(`o${i + 1}`, `2026-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`)));
  assert.equal(orderHistory(store, 'c1').pages, 2);
  assert.equal(orderHistory(store, 'c1', 2).rows.length, 2);
});

test('credit pays an open order', () => {
  const store = createOrderStore([order('o1', '2026-03-01T10:00:00Z', { status: 'open', balanceCents: 1000 })]);
  assert.deepEqual(applyCredit(store, 'c1', 1500), { applied: [{ orderId: 'o1', cents: 1000 }], leftCents: 500 });
  assert.equal(store.openOrders('c1').length, 0);
});

test('buy again offers the lines of an order', () => {
  const store = createOrderStore([order('o1', '2026-03-01T10:00:00Z', { lines: [{ sku: 'tea', qty: 2, priceCents: 400 }] })]);
  assert.deepEqual(buyAgain(store, 'c1'), { fromOrder: 'o1', items: [{ sku: 'tea', qty: 2 }] });
  assert.equal(buyAgain(store, 'nobody'), null);
});
