import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyOrderAdjustments, formatCents } from '../src/index.js';

test('shipping follows the weight and the discount follows the amount', () => {
  const out = applyOrderAdjustments(
    [
      { id: 'a', amount: 3000, weightKg: '1' },
      { id: 'b', amount: 1000, weightKg: '3' },
    ],
    { discount: -400, shipping: 800 },
  );
  assert.deepEqual(out.map((l) => [l.discountShare, l.shippingShare, l.total]), [
    [-300, 200, 2900],
    [-100, 600, 1500],
  ]);
});

test('no adjustments leave the lines unchanged', () => {
  const out = applyOrderAdjustments([{ id: 'a', amount: 1234, weightKg: 0.5 }]);
  assert.equal(out[0].total, 1234);
});

test('formats receipts', () => {
  assert.equal(formatCents(123456), '1,234.56');
  assert.equal(formatCents(-5), '-0.05');
});
