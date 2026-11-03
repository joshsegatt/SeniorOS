import test from 'node:test';
import assert from 'node:assert/strict';
import { exportOrdersCsv } from '../../src/reports/orders-csv.js';
import { findReport } from '../../src/reports/index.js';
import { createReportsRoute } from '../../src/admin/reports-route.js';

const HEADER = 'id,date,customer,items,total';

/** @returns {Record<string, any>} */
const order = (id, placedAt, extra = {}) => ({
  id,
  customerName: 'Ada',
  placedAt,
  status: 'paid',
  shippingCents: 0,
  discountCents: 0,
  lines: [{ sku: 'tea', name: 'Green tea', unitCents: 1000, qty: 1 }],
  ...extra,
});

/** Data lines of a CSV string (header dropped, an optional trailing line break ignored). */
function rows(csv) {
  const lines = String(csv).split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();
  assert.equal(lines[0], HEADER);
  return lines.slice(1);
}

test('1. header line, then one line per order', () => {
  const csv = exportOrdersCsv([order('o-1', '2026-10-05T10:00:00Z')], {});
  assert.deepEqual(rows(csv), ['o-1,2026-10-05,Ada,1,10.00']);
});

test('1. no orders: just the header', () => {
  assert.deepEqual(rows(exportOrdersCsv([], {})), []);
});

test('2. the date is the day in Zurich, not in UTC', () => {
  const csv = exportOrdersCsv([
    order('o-1', '2026-09-30T22:15:00Z'), // 00:15 on 1 October in Zurich (summer time)
    order('o-2', '2026-10-31T23:30:00Z'), // 00:30 on 1 November in Zurich (winter time)
    order('o-3', '2026-10-31T21:00:00Z'), // 22:00 on 31 October in Zurich
  ], {});
  const dates = Object.fromEntries(rows(csv).map((l) => [l.split(',')[0], l.split(',')[1]]));
  assert.deepEqual(dates, { 'o-1': '2026-10-01', 'o-2': '2026-11-01', 'o-3': '2026-10-31' });
});

test('3. items is the total quantity across lines', () => {
  const o = order('o-1', '2026-10-05T10:00:00Z', {
    lines: [{ sku: 'tea', name: 'Green tea', unitCents: 1250, qty: 2 }, { sku: 'pot', name: 'Teapot', unitCents: 3900, qty: 3 }],
  });
  assert.equal(rows(exportOrdersCsv([o], {}))[0].split(',')[3], '5');
});

test('4. total is what the customer paid (shipping in, discount out), two decimals', () => {
  const o = order('o-1', '2026-10-05T10:00:00Z', {
    shippingCents: 590,
    discountCents: 1000,
    lines: [{ sku: 'tea', name: 'Green tea', unitCents: 1250, qty: 2 }, { sku: 'pot', name: 'Teapot', unitCents: 3900, qty: 1 }],
  });
  assert.equal(rows(exportOrdersCsv([o], {}))[0].split(',')[4], '59.90');
  const round = order('o-2', '2026-10-05T11:00:00Z', { lines: [{ sku: 'tea', name: 'Green tea', unitCents: 5000, qty: 1 }] });
  assert.equal(rows(exportOrdersCsv([round], {}))[0].split(',')[4], '50.00');
});

test('5. from and to are inclusive days in shop time', () => {
  const orders = [
    order('before', '2026-09-30T21:00:00Z'), // 23:00 on 30 September in Zurich
    order('first', '2026-09-30T22:15:00Z'), // 00:15 on 1 October in Zurich
    order('last', '2026-10-31T22:30:00Z'), // 23:30 on 31 October in Zurich
    order('after', '2026-10-31T23:30:00Z'), // 00:30 on 1 November in Zurich
  ];
  const ids = rows(exportOrdersCsv(orders, { from: '2026-10-01', to: '2026-10-31' })).map((l) => l.split(',')[0]);
  assert.deepEqual(ids, ['first', 'last']);
  assert.deepEqual(rows(exportOrdersCsv(orders, { from: '2026-10-31' })).map((l) => l.split(',')[0]), ['last', 'after']);
  assert.deepEqual(rows(exportOrdersCsv(orders, { to: '2026-09-30' })).map((l) => l.split(',')[0]), ['before']);
});

test('5. from after to throws a RangeError', () => {
  assert.throws(() => exportOrdersCsv([], { from: '2026-11-01', to: '2026-10-01' }), RangeError);
});

test('5. a value that is not a real YYYY-MM-DD date throws a RangeError', () => {
  for (const bad of ['31.10.2026', '2026-13-01', '2026-02-30', 'yesterday', '2026-1-5']) {
    assert.throws(() => exportOrdersCsv([], { from: bad }), RangeError, `from: ${bad}`);
    assert.throws(() => exportOrdersCsv([], { to: bad }), RangeError, `to: ${bad}`);
  }
  assert.doesNotThrow(() => exportOrdersCsv([], { from: '2028-02-29', to: '2028-03-01' }));
});

test('6. cancelled orders are left out unless includeCancelled is true', () => {
  const orders = [order('o-1', '2026-10-05T10:00:00Z'), order('o-2', '2026-10-06T10:00:00Z', { status: 'cancelled' })];
  assert.deepEqual(rows(exportOrdersCsv(orders, {})).map((l) => l.split(',')[0]), ['o-1']);
  assert.deepEqual(rows(exportOrdersCsv(orders, { includeCancelled: true })).map((l) => l.split(',')[0]), ['o-1', 'o-2']);
});

test('7. oldest order first, by the time it was placed', () => {
  const orders = [
    order('c', '2026-10-06T08:00:00Z'),
    order('b', '2026-10-05T16:00:00Z'),
    order('a', '2026-10-05T07:00:00Z'),
  ];
  assert.deepEqual(rows(exportOrdersCsv(orders, {})).map((l) => l.split(',')[0]), ['a', 'b', 'c']);
  assert.deepEqual(orders.map((o) => o.id), ['c', 'b', 'a'], 'the input array is not reordered');
});

test('8. values with commas, quotes or line breaks are quoted, quotes doubled', () => {
  const orders = [
    order('o-1', '2026-10-05T10:00:00Z', { customerName: 'Müller, Hans' }),
    order('o-2', '2026-10-05T11:00:00Z', { customerName: 'Anna "Nan" Lee' }),
    order('o-3', '2026-10-05T12:00:00Z', { customerName: 'Line\nBreak' }),
  ];
  const csv = exportOrdersCsv(orders, {});
  assert.ok(csv.includes('o-1,2026-10-05,"Müller, Hans",1,10.00'), csv);
  assert.ok(csv.includes('o-2,2026-10-05,"Anna ""Nan"" Lee",1,10.00'), csv);
  assert.ok(csv.includes('o-3,2026-10-05,"Line\nBreak",1,10.00'), csv);
  assert.ok(csv.includes('o-4') === false);
});

test('9. registered as orders-csv, listed in the menu, served as a CSV download', () => {
  const report = findReport('orders-csv');
  assert.ok(report, 'orders-csv is registered');
  const orders = [order('o-1', '2026-10-05T10:00:00Z'), order('o-2', '2026-10-06T10:00:00Z', { status: 'cancelled' })];
  const handle = createReportsRoute({ loadOrders: () => orders });
  const menu = JSON.parse(handle({ method: 'GET', path: '/reports' }).body);
  assert.ok(menu.some((r) => r.id === 'orders-csv'), 'listed in the Reports menu');
  const res = handle({ method: 'GET', path: '/reports/orders-csv' });
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /^text\/csv/);
  assert.match(res.headers['content-disposition'] ?? '', /orders-csv\.csv/);
  assert.deepEqual(rows(res.body), ['o-1,2026-10-05,Ada,1,10.00']);
});

test('9. the admin route passes the filters through from the query string', () => {
  const orders = [
    order('o-1', '2026-10-05T10:00:00Z'),
    order('o-2', '2026-10-06T10:00:00Z', { status: 'cancelled' }),
    order('o-3', '2026-11-02T10:00:00Z'),
  ];
  const handle = createReportsRoute({ loadOrders: () => orders });
  const ids = (query) => rows(handle({ method: 'GET', path: '/reports/orders-csv', query }).body).map((l) => l.split(',')[0]);
  assert.deepEqual(ids({ from: '2026-10-01', to: '2026-10-31' }), ['o-1']);
  assert.deepEqual(ids({ includeCancelled: 'false' }), ['o-1', 'o-3']);
  assert.deepEqual(ids({ includeCancelled: 'true', to: '2026-10-31' }), ['o-1', 'o-2']);
  assert.equal(handle({ method: 'GET', path: '/reports/orders-csv', query: { from: '2026-02-30' } }).status, 400);
});
