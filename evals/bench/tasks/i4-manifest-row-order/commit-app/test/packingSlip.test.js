import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../src/store.js';
import { packingSlipLines, renderPackingSlip } from '../src/packingSlip.js';
import { NotFoundError } from '../src/errors.js';
import { sampleSeed } from '../data/sample-shipments.js';

test('packing slip follows position, not insertion order', () => {
  const store = createStore(sampleSeed);
  assert.deepEqual(packingSlipLines(store, 'SH-1001').map((l) => l.sku), ['YST-01', 'FLR-25', 'BOX-S']);
});

test('cancelled lines are not on the packing slip', () => {
  const store = createStore(sampleSeed);
  assert.deepEqual(packingSlipLines(store, 'SH-1002').map((l) => l.sku), ['OIL-5W']);
});

test('renders a numbered slip', () => {
  const store = createStore(sampleSeed);
  assert.match(renderPackingSlip(store, 'SH-1001'), /^Packing slip SH-1001[^\n]*\n1\. YST-01 x10/);
});

test('unknown shipment', () => {
  const store = createStore(sampleSeed);
  assert.throws(() => packingSlipLines(store, 'nope'), NotFoundError);
});
