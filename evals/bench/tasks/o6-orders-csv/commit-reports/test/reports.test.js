import test from 'node:test';
import assert from 'node:assert/strict';
import { orderTotal } from '../src/orders/orders.js';
import { revenueByMonth } from '../src/reports/revenue.js';
import { topProducts } from '../src/reports/top-products.js';
import { createReportsRoute } from '../src/admin/reports-route.js';

const orders = [
  { id: 'o-1', customerName: 'Ada', placedAt: '2026-09-30T10:00:00Z', status: 'paid', shippingCents: 500, discountCents: 0,
    lines: [{ sku: 'tea', name: 'Green tea', unitCents: 1250, qty: 2 }] },
  { id: 'o-2', customerName: 'Bob', placedAt: '2026-10-02T10:00:00Z', status: 'shipped', shippingCents: 0, discountCents: 300,
    lines: [{ sku: 'tea', name: 'Green tea', unitCents: 1250, qty: 1 }, { sku: 'pot', name: 'Teapot', unitCents: 3900, qty: 1 }] },
  { id: 'o-3', customerName: 'Cy', placedAt: '2026-10-03T10:00:00Z', status: 'cancelled', shippingCents: 500, discountCents: 0,
    lines: [{ sku: 'pot', name: 'Teapot', unitCents: 3900, qty: 5 }] },
];

test('orderTotal adds shipping and subtracts the discount', () => {
  assert.equal(orderTotal(orders[0]), 3000);
  assert.equal(orderTotal(orders[1]), 4850);
});

test('revenue by month skips cancelled orders', () => {
  assert.deepEqual(revenueByMonth(orders), [
    { month: '2026-09', orders: 1, revenueCents: 3000 },
    { month: '2026-10', orders: 1, revenueCents: 4850 },
  ]);
});

test('top products by quantity', () => {
  assert.deepEqual(topProducts(orders, 1), [{ sku: 'tea', name: 'Green tea', qty: 3 }]);
});

test('the reports menu lists every report by title', () => {
  const handle = createReportsRoute({ loadOrders: () => orders });
  const res = handle({ method: 'GET', path: '/reports' });
  assert.equal(res.status, 200);
  const titles = JSON.parse(res.body).map((r) => r.title);
  assert.deepEqual(titles, [...titles].sort((a, b) => a.localeCompare(b)));
  assert.ok(titles.includes('Revenue by month') && titles.includes('Top products'));
});

test('a JSON report runs through the route', () => {
  const handle = createReportsRoute({ loadOrders: () => orders });
  const res = handle({ method: 'GET', path: '/reports/top-products', query: { limit: 1 } });
  assert.equal(res.headers['content-type'], 'application/json');
  assert.equal(JSON.parse(res.body)[0].sku, 'tea');
});
