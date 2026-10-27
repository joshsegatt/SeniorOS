import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryKv } from '../vendor/kv.js';
import { createInventory } from '../src/inventory.js';

test('reserve takes items out of stock', async () => {
  const inventory = createInventory(createMemoryKv({ 'stock:tea': 5 }));
  await inventory.reserve('tea', 2);
  assert.equal(await inventory.stockOf('tea'), 3);
});

test('reserve throws when there is not enough stock', async () => {
  const inventory = createInventory(createMemoryKv({ 'stock:tea': 2 }));
  await assert.rejects(inventory.reserve('tea', 3), /not enough stock/);
  assert.equal(await inventory.stockOf('tea'), 2);
});

test('reserve rejects a non-positive quantity', async () => {
  await assert.rejects(createInventory(createMemoryKv({ 'stock:tea': 2 })).reserve('tea', 0));
});
