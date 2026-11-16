import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../../src/db/store.js';
import { balanceMismatches, ledgerBalance } from '../../src/loyalty/ledger.js';
import { run } from '../../scripts/backfill-points.js';

// A script may dry-run by default; these are the ways runs asked it to write.
const APPLY = { apply: true, dryRun: false, dry: false, write: true };

const order = (id, customerId, placedAt, totalCents, status = 'paid') => ({ id, customerId, totalCents, status, placedAt });
const earned = (id, customerId, orderId, type, points, at) => ({ id, customerId, orderId, type, points, at });

/** Production on the night of the backfill: points went live on Nov 3, so newer orders already earned theirs. */
function production() {
  return createStore({
    meta: { seq: 5006 },
    customers: [
      { id: 'c-101', name: 'Dana Reyes', email: 'dana.reyes@example.com', points: 33 },
      { id: 'c-102', name: 'Omar Haddad', email: 'omar.haddad@example.com' },
      { id: 'c-103', name: 'Ines Moreau', email: 'ines.moreau@example.com', points: 250 },
      { id: 'c-104', name: 'Liam Novak', email: 'liam.novak@example.com' },
    ],
    orders: [
      order('o-3001', 'c-102', '2025-12-20T10:00:00.000Z', 20000),
      order('o-3010', 'c-101', '2026-02-14T18:22:00.000Z', 8490),
      order('o-3022', 'c-102', '2026-03-03T09:10:00.000Z', 1999),
      order('o-3035', 'c-101', '2026-06-03T12:45:00.000Z', 12900),
      order('o-3041', 'c-101', '2026-07-10T08:30:00.000Z', 6000, 'cancelled'),
      order('o-3050', 'c-104', '2026-08-19T16:05:00.000Z', 4550),
      order('o-3058', 'c-101', '2026-09-21T19:40:00.000Z', 4550),
      order('o-3063', 'c-104', '2026-10-30T11:11:00.000Z', 1240),
      order('o-3071', 'c-103', '2026-11-04T10:00:00.000Z', 25000),
      order('o-3074', 'c-101', '2026-11-05T15:00:00.000Z', 3999),
      order('o-3080', 'c-103', '2026-11-06T09:00:00.000Z', 8000, 'cancelled'),
      order('o-3085', 'c-101', '2026-11-10T12:30:00.000Z', 2470),
    ],
    ledger: [
      earned('pt-5001', 'c-103', 'o-3071', 'earn', 250, '2026-11-04T10:00:00.000Z'),
      earned('pt-5002', 'c-101', 'o-3074', 'earn', 39, '2026-11-05T15:00:00.000Z'),
      earned('pt-5003', 'c-103', 'o-3080', 'earn', 80, '2026-11-06T09:00:00.000Z'),
      earned('pt-5004', 'c-103', 'o-3080', 'reverse', -80, '2026-11-06T14:00:00.000Z'),
      earned('pt-5005', 'c-101', 'o-3085', 'redeem', -30, '2026-11-10T12:30:00.000Z'),
      earned('pt-5006', 'c-101', 'o-3085', 'earn', 24, '2026-11-10T12:30:00.000Z'),
    ],
  });
}

const EXPECTED_BALANCES = { 'c-101': 33 + 84 + 129 + 45, 'c-102': 19, 'c-103': 250, 'c-104': 45 + 12 };
const EXPECTED_LEDGER = [
  ['c-101', 'o-3010', 'earn', 84],
  ['c-101', 'o-3035', 'earn', 129],
  ['c-101', 'o-3058', 'earn', 45],
  ['c-101', 'o-3074', 'earn', 39],
  ['c-101', 'o-3085', 'earn', 24],
  ['c-101', 'o-3085', 'redeem', -30],
  ['c-102', 'o-3022', 'earn', 19],
  ['c-103', 'o-3071', 'earn', 250],
  ['c-103', 'o-3080', 'earn', 80],
  ['c-103', 'o-3080', 'reverse', -80],
  ['c-104', 'o-3050', 'earn', 45],
  ['c-104', 'o-3063', 'earn', 12],
];

/** The ledger as comparable rows (ids and timestamps are the script's own business). */
const ledgerRows = (store) => store
  .all('ledger')
  .filter((e) => e.points !== 0)
  .map((e) => [e.customerId, e.orderId, e.type, e.points])
  .sort((a, b) => a.join('|').localeCompare(b.join('|')));

function assertBackfilled(store, label) {
  assert.deepEqual(ledgerRows(store), EXPECTED_LEDGER, `${label}: ledger`);
  for (const [customerId, points] of Object.entries(EXPECTED_BALANCES)) {
    assert.equal(store.get('customers', customerId).points ?? 0, points, `${label}: balance of ${customerId}`);
    assert.equal(ledgerBalance(store, customerId), points, `${label}: ledger total of ${customerId}`);
  }
  assert.deepEqual(balanceMismatches(store), [], `${label}: balance mismatches`);
  assert.deepEqual(store.all('orders'), production().all('orders'), `${label}: orders untouched`);
}

const READS = new Set(['all', 'get', 'getMeta', 'dump']);

/** The same store seen through a connection that drops after `allowed` writes: everything after that fails. */
function droppingAfter(store, allowed, counter = { writes: 0 }) {
  let dead = false;
  return new Proxy(store, {
    get(target, key) {
      const value = target[key];
      if (typeof value !== 'function') return value;
      return (...args) => {
        if (dead) throw new Error('connection lost');
        if (!READS.has(key)) {
          counter.writes += 1;
          if (counter.writes > allowed) {
            dead = true;
            throw new Error('connection lost');
          }
        }
        return value(...args);
      };
    },
  });
}

test('the backfill gives every customer the points for their 2026 orders before the launch', async () => {
  const store = production();
  await run(store, APPLY);
  assertBackfilled(store, 'one run');
});

test('running the backfill a second time changes nothing', async () => {
  const store = production();
  await run(store, APPLY);
  const once = { ledger: ledgerRows(store), customers: store.all('customers') };
  await run(store, APPLY);
  assert.deepEqual({ ledger: ledgerRows(store), customers: store.all('customers') }, once);
  assertBackfilled(store, 'two runs');
});

test('a run that died halfway is completed by running it again', async () => {
  const counter = { writes: 0 };
  await run(droppingAfter(production(), Infinity, counter), APPLY);
  const total = counter.writes;
  assert.ok(total > 0, 'the backfill writes nothing');
  for (let allowed = 0; allowed < total; allowed += 1) {
    const store = production();
    try {
      await run(droppingAfter(store, allowed), APPLY);
    } catch {
      // the job died: the operator runs it again
    }
    await run(store, APPLY);
    assertBackfilled(store, `died after ${allowed} of ${total} writes, then ran again`);
  }
});

test('orders placed after the backfill earn points as usual and a later run leaves them alone', async () => {
  const store = production();
  await run(store, APPLY);
  const { placeOrder } = await import('../../src/orders/orders.js');
  placeOrder(store, { customerId: 'c-102', totalCents: 5000 }, () => new Date('2026-11-17T10:00:00Z'));
  await run(store, APPLY);
  assert.equal(store.get('customers', 'c-102').points, 19 + 50);
  assert.equal(ledgerBalance(store, 'c-102'), 19 + 50);
});
