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

test('concurrent reservations never oversell', async () => {
  const kv = createMemoryKv({ 'stock:tea': 3 });
  const settled = await Promise.allSettled(Array.from({ length: 6 }, (_, i) => createInventory(kv).reserve('tea', 1)));
  assert.equal(settled.filter((s) => s.status === 'fulfilled').length, 3);
  assert.equal(await createInventory(kv).stockOf('tea'), 0);
});
