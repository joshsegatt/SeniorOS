import test from 'node:test';
import assert from 'node:assert/strict';
import { syncOrders } from '../../src/accounting/sync.js';
import { createOrderSource } from '../../src/accounting/store.js';
import { createLedgerlyDouble, createWatchedCheckpoint } from './ledgerly-double.js';

const ids = Array.from({ length: 24 }, (_, i) => i + 1);
const rows = () => ids.map((id) => ({ id, totalCents: id * 100, placedAt: '2026-10-01T10:00:00.000Z' }));

test('uploads every order in parallel, within the 4-in-flight limit', async () => {
  const ledgerly = createLedgerlyDouble({ latencyMs: () => 5 });
  const checkpoint = createWatchedCheckpoint(ledgerly, ids);
  await syncOrders({ orders: createOrderSource(rows()), ledgerly, checkpoint });
  assert.deepEqual([...ledgerly.received.keys()].sort((a, b) => a - b), ids);
  assert.equal(ledgerly.stats.tooManyRequests, 0, `${ledgerly.stats.tooManyRequests} request(s) over Ledgerly's limit (max in flight ${ledgerly.stats.maxInFlight})`);
  assert.ok(ledgerly.stats.maxInFlight >= 2, `uploads are still sequential (max in flight ${ledgerly.stats.maxInFlight})`);
  assert.equal(await checkpoint.get(), 24);
  assert.deepEqual(checkpoint.violations, []);
});

test('the checkpoint never moves past an order Ledgerly does not have (uneven latencies)', async () => {
  const ledgerly = createLedgerlyDouble({ latencyMs: (id) => (id % 5 === 1 ? 25 : 2) });
  const checkpoint = createWatchedCheckpoint(ledgerly, ids);
  await syncOrders({ orders: createOrderSource(rows()), ledgerly, checkpoint });
  assert.deepEqual(checkpoint.violations, []);
  assert.equal(await checkpoint.get(), 24);
  assert.equal(ledgerly.stats.tooManyRequests, 0);
});

test('after a failed upload, running the sync again uploads every order', async () => {
  // Order 6 is slow and fails; orders after it succeed while it is in flight.
  const ledgerly = createLedgerlyDouble({ latencyMs: (id) => (id === 6 ? 30 : 2), failing: [6] });
  const checkpoint = createWatchedCheckpoint(ledgerly, ids);
  const orders = createOrderSource(rows());
  await syncOrders({ orders, ledgerly, checkpoint }).catch(() => {});
  assert.ok(!ledgerly.received.has(6));
  assert.ok((await checkpoint.get()) < 6, `checkpoint moved to ${await checkpoint.get()} although order 6 was never uploaded`);

  ledgerly.failing.clear(); // Ledgerly is back
  await syncOrders({ orders, ledgerly, checkpoint });
  assert.deepEqual([...ledgerly.received.keys()].sort((a, b) => a - b), ids);
  assert.equal(await checkpoint.get(), 24);
  assert.deepEqual(checkpoint.violations, []);
  assert.equal(ledgerly.stats.tooManyRequests, 0);

  // A third run has nothing left to do and must not fail.
  await syncOrders({ orders, ledgerly, checkpoint });
  assert.equal(await checkpoint.get(), 24);
});
