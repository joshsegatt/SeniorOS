import test from 'node:test';
import assert from 'node:assert/strict';
import { createShopApi } from '../../src/shop/api.js';
import { exportOrders } from '../../src/shop/export.js';

const HOURLY_LIMIT = 2000; // config/shop-api.json

/** The platform API, enforcing the plan's rate limit like production does. */
function platform(orders) {
  const sorted = [...orders].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.order_number - b.order_number);
  const ranges = new Map();
  const fake = {
    calls: 0,
    async get(path, query = {}) {
      fake.calls += 1;
      if (fake.calls > HOURLY_LIMIT) throw new Error('shop API 429 for ' + path + ' (rate limit: 2000 requests per hour)');
      const one = /^\/v2\/orders\/(.+)$/.exec(path);
      if (one) return sorted.find((o) => String(o.order_number) === decodeURIComponent(one[1])) ?? null;
      if (path !== '/v2/orders') throw new Error(`shop API 404 for ${path}`);
      const key = `${query.created_from}|${query.created_to}`;
      if (!ranges.has(key)) ranges.set(key, sorted.filter((o) => o.created_at >= query.created_from && o.created_at < query.created_to));
      const inRange = ranges.get(key);
      const start = query.cursor ? Number(Buffer.from(query.cursor, 'base64url').toString()) : 0;
      const limit = Math.min(Number(query.limit ?? 100), 100);
      const slice = inRange.slice(start, start + limit);
      const next = start + limit < inRange.length ? Buffer.from(String(start + limit)).toString('base64url') : null;
      return { data: query.fields === 'id' ? slice.map((o) => ({ id: o.id })) : slice.map((o) => structuredClone(o)), next_cursor: next };
    },
  };
  return fake;
}

function raw(n, createdAt, extra = {}) {
  return { id: `ord_${n}`, order_number: 1000 + n, created_at: createdAt, currency: 'EUR', customer: { email: `customer${n}@example.com` }, totals: { net: '100.00', tax: '19.00', gross: '119.00' }, financial_status: 'paid', ...extra };
}

const rows = (csv) => csv.replace(/\r?\n$/, '').split(/\r?\n/);

test('exports one row per order of the month, with the header first', async () => {
  const orders = [
    raw(1, '2026-10-01T00:00:00Z', { customer: { email: 'ana@example.com' }, totals: { net: '41.18', tax: '7.82', gross: '49.00' } }),
    raw(2, '2026-10-15T12:30:00Z', { customer: { email: 'ben@example.com' }, financial_status: 'refunded' }),
    raw(3, '2026-10-31T23:59:59Z', { customer: { email: 'cy@example.com' } }),
    raw(4, '2026-09-30T23:59:59Z'),
    raw(5, '2026-11-01T00:00:00Z'),
  ];
  const csv = await exportOrders(createShopApi(platform(orders)), '2026-10');
  const lines = rows(csv);
  assert.equal(lines.length, 4, csv);
  assert.match(lines[0].toLowerCase(), /number/);
  const row1001 = lines.find((l) => l.includes('1001'));
  assert.ok(row1001, csv);
  assert.match(row1001, /ana@example\.com/);
  assert.match(row1001, /49(\.00)?\b/);
  assert.match(row1001, /41\.18/);
  assert.match(row1001, /7\.82/);
  assert.match(lines.find((l) => l.includes('1002')) ?? '', /refunded/);
  assert.ok(!csv.includes('1004') && !csv.includes('1005'), 'orders from other months are not exported');
});

test('an empty month exports just the header', async () => {
  const csv = await exportOrders(createShopApi(platform([raw(1, '2026-09-10T10:00:00Z')])), '2026-10');
  assert.equal(rows(csv).length, 1);
});

test("a month the size of production exports within the API's hourly rate limit", async () => {
  const orders = [];
  const monthMs = Date.parse('2026-11-01T00:00:00Z') - Date.parse('2026-10-01T00:00:00Z');
  for (let i = 0; i < 36_000; i += 1) orders.push(raw(i, new Date(Date.parse('2026-10-01T00:00:00Z') + Math.floor((i * monthMs) / 36_000)).toISOString()));
  for (let i = 0; i < 400; i += 1) orders.push(raw(50_000 + i, '2026-09-20T10:00:00.000Z'), raw(60_000 + i, '2026-11-02T10:00:00.000Z'));
  const http = platform(orders);
  const csv = await exportOrders(createShopApi(http), '2026-10');
  const lines = rows(csv);
  assert.equal(lines.length, 36_001);
  const tokens = new Set(csv.match(/\d+/g));
  for (let i = 0; i < 36_000; i += 1) if (!tokens.has(String(1000 + i))) assert.fail(`order ${1000 + i} is missing`);
  assert.ok(!tokens.has('50000') && !tokens.has('60399'), 'orders from other months are not exported');
  assert.ok(http.calls <= HOURLY_LIMIT, `${http.calls} API requests for 360 pages of orders`);
});
