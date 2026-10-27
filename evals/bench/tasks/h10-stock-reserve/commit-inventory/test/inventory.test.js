import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryKv } from '../vendor/kv.js';
import { createInventory } from '../src/inventory.js';

test('stock of an unknown sku is 0', async () => {
  assert.equal(await createInventory(createMemoryKv()).stockOf('tea'), 0);
});

test('restock adds to the stock', async () => {
  const inventory = createInventory(createMemoryKv({ 'stock:tea': 3 }));
  await inventory.restock('tea', 5);
  assert.equal(await inventory.stockOf('tea'), 8);
});

test('restock rejects a non-positive quantity', async () => {
  await assert.rejects(createInventory(createMemoryKv()).restock('tea', 0));
});
