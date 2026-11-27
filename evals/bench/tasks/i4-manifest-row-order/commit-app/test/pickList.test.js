import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/store.js';
import { pickList } from '../src/pickList.js';
import { sampleSeed } from '../data/sample-shipments.js';

test('pick list is heaviest first', () => {
  const store = createStore(sampleSeed);
  assert.deepEqual(pickList(store, 'SH-1001').map((l) => [l.sku, l.weightKg]), [
    ['FLR-25', '100.000'],
    ['BOX-S', '8.000'],
    ['YST-01', '5.000'],
  ]);
});
