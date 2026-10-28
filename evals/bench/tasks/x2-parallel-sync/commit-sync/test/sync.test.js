import test from 'node:test';
import assert from 'node:assert/strict';
import { syncOrders, toLedgerlyOrder } from '../src/accounting/sync.js';
import { createCheckpoint, createOrderSource } from '../src/accounting/store.js';
import { createFakeLedgerly } from './support/fake-ledgerly.js';

const order = (id) => ({ id, totalCents: id * 100, placedAt: `2026-10-0${id}T10:00:00.000Z` });

test('maps an order to the Ledgerly format', () => {
  assert.deepEqual(toLedgerlyOrder(order(3)), { orderId: 3, totalCents: 300, currency: 'CHF', placedAt: '2026-10-03T10:00:00.000Z' });
});

test('uploads every placed order and moves the checkpoint to the last one', async () => {
  const ledgerly = createFakeLedgerly();
  const checkpoint = createCheckpoint();
  await syncOrders({ orders: createOrderSource([order(1), order(2), order(3)]), ledgerly, checkpoint });
  assert.deepEqual([...ledgerly.received.keys()].sort(), [1, 2, 3]);
  assert.equal(await checkpoint.get(), 3);
});

test('resumes after the checkpoint', async () => {
  const ledgerly = createFakeLedgerly();
  const checkpoint = createCheckpoint(2);
  await syncOrders({ orders: createOrderSource([order(1), order(2), order(3)]), ledgerly, checkpoint });
  assert.deepEqual([...ledgerly.received.keys()], [3]);
  assert.equal(await checkpoint.get(), 3);
});

test('a failed upload fails the run and leaves the checkpoint before that order', async () => {
  const ledgerly = createFakeLedgerly({ failing: [2] });
  const checkpoint = createCheckpoint();
  await assert.rejects(syncOrders({ orders: createOrderSource([order(1), order(2), order(3)]), ledgerly, checkpoint }));
  assert.equal(await checkpoint.get(), 1);
});
