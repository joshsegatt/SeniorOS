import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarize } from '../src/metrics.js';

test('summarize sales and refunds', () => {
  assert.deepEqual(
    summarize([
      { type: 'sale', amountCents: 4000 },
      { type: 'sale', amountCents: 1000 },
      { type: 'refund', amountCents: 1500 },
    ]),
    { salesCents: 5000, refundsCents: 1500, netCents: 3500, sales: 2 },
  );
});

test('an empty day is all zeros', () => {
  assert.deepEqual(summarize([]), { salesCents: 0, refundsCents: 0, netCents: 0, sales: 0 });
});
