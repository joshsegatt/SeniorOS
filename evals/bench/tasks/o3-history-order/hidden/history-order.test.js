import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderStore } from '../../src/orders/store.js';
import { orderHistory } from '../../src/orders/history.js';
import { applyCredit } from '../../src/billing/credits.js';
import { buyAgain } from '../../src/marketing/reorder.js';

const day = (n) => new Date(Date.UTC(2025, 0, 1) + n * 86_400_000).toISOString();

/** Seeded in a shuffled order on purpose: the store must not rely on insertion order. */
function history(count) {
  const ids = Array.from({ length: count }, (_, i) => i + 1);
  const shuffled = ids.map((n) => ids[(n * 7) % count]);
  return shuffled.map((n) => ({
    id: `o${n}`,
    customerId: 'c1',
    placedAt: day(n * 3),
    totalCents: 1000 + n,
    balanceCents: 0,
    status: 'paid',
    lines: [{ sku: `sku-${n}`, qty: 1, priceCents: 1000 + n }],
  }));
}

test('order history shows the newest orders first', () => {
  const store = createOrderStore(history(25));
  const first = orderHistory(store, 'c1');
  assert.equal(first.pages, 3);
  assert.deepEqual(first.rows.map((r) => r.id), ['o25', 'o24', 'o23', 'o22', 'o21', 'o20', 'o19', 'o18', 'o17', 'o16']);
  assert.deepEqual(orderHistory(store, 'c1', 2).rows.map((r) => r.id), ['o15', 'o14', 'o13', 'o12', 'o11', 'o10', 'o9', 'o8', 'o7', 'o6']);
  assert.deepEqual(orderHistory(store, 'c1', 3).rows.map((r) => r.id), ['o5', 'o4', 'o3', 'o2', 'o1']);
});

test('store credit still pays the oldest unpaid order first', () => {
  const seed = history(6).map((o) => (['o2', 'o4', 'o5'].includes(o.id) ? { ...o, status: 'open', balanceCents: 1000 } : o));
  const store = createOrderStore(seed);
  const result = applyCredit(store, 'c1', 1500);
  assert.deepEqual(result.applied, [{ orderId: 'o2', cents: 1000 }, { orderId: 'o4', cents: 500 }]);
  const open = store.openOrders('c1').map((o) => [o.id, o.balanceCents]).sort((a, b) => a[0].localeCompare(b[0]));
  assert.deepEqual(open, [['o4', 500], ['o5', 1000]]);
});

test('buy again still offers the most recent order', () => {
  const seed = history(8).map((o) => (o.id === 'o8' ? { ...o, status: 'cancelled' } : o));
  const store = createOrderStore(seed);
  assert.deepEqual(buyAgain(store, 'c1'), { fromOrder: 'o7', items: [{ sku: 'sku-7', qty: 1 }] });
});
