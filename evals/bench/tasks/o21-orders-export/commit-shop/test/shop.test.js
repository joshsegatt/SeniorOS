import test from 'node:test';
import assert from 'node:assert/strict';
import { createShopApi } from '../src/shop/api.js';
import { listOrders, toOrder } from '../src/shop/orders.js';
import { monthRange } from '../src/shop/dates.js';
import { fakeShopHttp, rawOrder } from './helpers/fake-shop-http.js';

test('month ranges', () => {
  assert.deepEqual(monthRange('2026-12'), { from: '2026-12-01T00:00:00.000Z', to: '2027-01-01T00:00:00.000Z' });
  assert.throws(() => monthRange('2026-13'), /invalid month/);
});

test('raw orders become our orders', () => {
  const order = toOrder(rawOrder(1, '2026-10-02T09:00:00Z', { financial_status: 'voided', totals: { net: '10.00', tax: '1.90', gross: '11.90' } }));
  assert.deepEqual(order, { number: '1001', createdAt: '2026-10-02T09:00:00Z', email: 'customer1@example.com', currency: 'EUR', net: 10, vat: 1.9, gross: 11.9, status: 'cancelled' });
});

test('the admin list pages through the orders of a range', async () => {
  const orders = Array.from({ length: 250 }, (_, i) => rawOrder(i, `2026-10-${String(1 + (i % 28)).padStart(2, '0')}T10:00:00Z`));
  const api = createShopApi(fakeShopHttp(orders));
  const range = monthRange('2026-10');
  const p1 = await listOrders(api, { ...range, page: 1 });
  const p3 = await listOrders(api, { ...range, page: 3 });
  const p4 = await listOrders(api, { ...range, page: 4 });
  assert.equal(p1.orders.length, 100);
  assert.equal(p1.hasMore, true);
  assert.equal(p3.orders.length, 50);
  assert.equal(p3.hasMore, false);
  assert.deepEqual(p4.orders, []);
  assert.equal(new Set([...p1.orders, ...p3.orders].map((o) => o.number)).size, 150);
});

test('a single order', async () => {
  const api = createShopApi(fakeShopHttp([rawOrder(7, '2026-10-05T10:00:00Z')]));
  assert.equal(toOrder(await api.getOrder('1007')).email, 'customer7@example.com');
});
