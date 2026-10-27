import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryKv } from '../../vendor/kv.js';
import { createInventory } from '../../src/inventory.js';

const outcomes = async (promises) => {
  const settled = await Promise.allSettled(promises);
  return { ok: settled.filter((s) => s.status === 'fulfilled').length, failed: settled.filter((s) => s.status === 'rejected').length };
};

test('reserve takes items out of stock', async () => {
  const inventory = createInventory(createMemoryKv({ 'stock:tea': 5 }));
  await inventory.reserve('tea', 2);
  assert.equal(await inventory.stockOf('tea'), 3);
  await inventory.reserve('tea', 3);
  assert.equal(await inventory.stockOf('tea'), 0);
});

test('reserve throws when there is not enough stock and leaves it unchanged', async () => {
  const inventory = createInventory(createMemoryKv({ 'stock:tea': 2 }));
  await assert.rejects(inventory.reserve('tea', 3));
  assert.equal(await inventory.stockOf('tea'), 2);
  await assert.rejects(inventory.reserve('cake', 1));
  assert.equal(await inventory.stockOf('cake'), 0);
});

test('concurrent orders never sell more than the stock', async () => {
  const inventory = createInventory(createMemoryKv({ 'stock:tea': 5 }));
  const { ok, failed } = await outcomes(Array.from({ length: 10 }, () => inventory.reserve('tea', 1)));
  assert.equal(ok, 5, `${ok} orders reserved 5 units`);
  assert.equal(failed, 5);
  assert.equal(await inventory.stockOf('tea'), 0);
});

test('two concurrent orders for the last units: only one gets them', async () => {
  const inventory = createInventory(createMemoryKv({ 'stock:tea': 5 }));
  const { ok } = await outcomes([inventory.reserve('tea', 3), inventory.reserve('tea', 3)]);
  assert.equal(ok, 1, 'both orders got 3 of 5 units');
  assert.equal(await inventory.stockOf('tea'), 2);
});

test('orders handled by different app instances share the same stock', async () => {
  const kv = createMemoryKv({ 'stock:tea': 7 });
  const instances = [createInventory(kv), createInventory(kv)];
  const { ok } = await outcomes(Array.from({ length: 20 }, (_, i) => instances[i % 2].reserve('tea', 1)));
  assert.equal(ok, 7, `${ok} orders reserved 7 units`);
  assert.equal(await instances[0].stockOf('tea'), 0);
});

test('after selling out, restocked items can be reserved again', async () => {
  const inventory = createInventory(createMemoryKv({ 'stock:tea': 1 }));
  await outcomes([inventory.reserve('tea', 1), inventory.reserve('tea', 1)]);
  await inventory.restock('tea', 2);
  await inventory.reserve('tea', 2);
  assert.equal(await inventory.stockOf('tea'), 0);
});
