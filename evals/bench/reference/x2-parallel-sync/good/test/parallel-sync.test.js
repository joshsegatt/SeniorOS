import test from 'node:test';
import assert from 'node:assert/strict';
import { syncOrders } from '../src/accounting/sync.js';
import { createCheckpoint, createOrderSource } from '../src/accounting/store.js';
import { createFakeLedgerly } from './support/fake-ledgerly.js';

const rows = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, totalCents: 100, placedAt: '2026-10-01T10:00:00.000Z' }));

test('uploads in parallel without exceeding Ledgerly limit', async () => {
  const ledgerly = createFakeLedgerly({ latencyMs: () => 3 });
  const checkpoint = createCheckpoint();
  await syncOrders({ orders: createOrderSource(rows(12)), ledgerly, checkpoint });
  assert.equal(ledgerly.received.size, 12);
  assert.equal(ledgerly.stats.tooManyRequests, 0);
  assert.ok(ledgerly.stats.maxInFlight > 1);
  assert.equal(await checkpoint.get(), 12);
});

test('a rerun after a failure finishes, even for orders uploaded past the checkpoint', async () => {
  const ledgerly = createFakeLedgerly({ latencyMs: (id) => (id === 3 ? 20 : 1), failing: [3] });
  const checkpoint = createCheckpoint();
  const orders = createOrderSource(rows(10));
  await assert.rejects(syncOrders({ orders, ledgerly, checkpoint }));
  assert.equal(await checkpoint.get(), 2);
  ledgerly.failing.clear();
  await syncOrders({ orders, ledgerly, checkpoint });
  assert.equal(ledgerly.received.size, 10);
  assert.equal(await checkpoint.get(), 10);
});
