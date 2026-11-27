import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allocate, applyOrderAdjustments } from '../../src/index.js';

const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const noNegativeZero = (xs) => xs.forEach((x, i) => assert.ok(!Object.is(x, -0), `part ${i} is -0`));

test('issue example: parts add up and the extra cents go to the first people', () => {
  assert.deepEqual(allocate(10000, [1, 1, 1]), [3334, 3333, 3333]);
  assert.deepEqual(allocate(5, [1, 1, 1, 1, 1, 1]), [1, 1, 1, 1, 1, 0]);
  assert.deepEqual(allocate(4, [1, 1, 1, 1, 1, 1]), [1, 1, 1, 1, 0, 0]);
  assert.deepEqual(allocate(2, [1, 1, 1, 1, 1, 1]), [1, 1, 0, 0, 0, 0]);
});

test('equal remainders are decided by index, with decimal weights read exactly', () => {
  assert.deepEqual(allocate(45, [0.7, 0.1, 0.1, 0.1]), [32, 5, 4, 4]);
  assert.deepEqual(allocate(81, [1.1, 2.2, 3.3]), [14, 27, 40]);
  assert.deepEqual(allocate(5, [0.15, 0.15, 0.35, 0.35]), [1, 1, 2, 1]);
  assert.deepEqual(allocate(5, ['0.15', '0.15', '0.35', '0.35']), [1, 1, 2, 1]);
  assert.deepEqual(allocate(45, ['0.70', '0.1', '0.100', '0.1']), [32, 5, 4, 4]);
});

test('negative totals mirror the positive allocation', () => {
  assert.deepEqual(allocate(-100, [1, 1, 1]), [-34, -33, -33]);
  assert.deepEqual(allocate(-1, [1, 1]), [-1, 0]);
  assert.deepEqual(allocate(-45, [0.7, 0.1, 0.1, 0.1]), [-32, -5, -4, -4]);
  const parts = allocate(-7, [0, 1, 0, 1]);
  assert.deepEqual(parts, [0, -4, 0, -3]);
  noNegativeZero(parts);
});

test('negative weights and a negative weight sum', () => {
  assert.deepEqual(allocate(100, ['0.5', '0.3', '-0.1']), [71, 43, -14]);
  assert.deepEqual(allocate(-100, ['0.5', '0.3', '-0.1']), [-71, -43, 14]);
  assert.deepEqual(allocate(7, [2, -1, 1]), [7, -3, 3]);
  assert.deepEqual(allocate(100, [-1, -3]), [25, 75]);
  assert.deepEqual(allocate(101, [-1, -1]), [51, 50]);
  assert.deepEqual(allocate(10, [3, -1]), [15, -5]);
});

test('zero weight sum', () => {
  assert.deepEqual(allocate(0, [1, -1]), [0, 0]);
  assert.throws(() => allocate(5, [1, -1]), RangeError);
  assert.throws(() => allocate(-5, ['0', '0.0']), RangeError);
});

test('totals near Number.MAX_SAFE_INTEGER are split exactly', () => {
  assert.deepEqual(allocate(9007199254740991, ['2', '3', '5']), [1801439850948198, 2702159776422297, 4503599627370496]);
  assert.deepEqual(allocate(9007199254740991, ['0.3', '0.7']), [2702159776422297, 6305039478318694]);
  assert.deepEqual(allocate(9007199254740990, [7, 11, 13]), [2033883702683449, 3196102961359706, 3777212590697835]);
  assert.deepEqual(allocate(-9007199254740991, [1, 1, 1]), [-3002399751580331, -3002399751580330, -3002399751580330]);
});

test('number weights in exponent form', () => {
  assert.deepEqual(allocate(10, [1e-7, 2e-7, 2e-7]), [2, 4, 4]);
  assert.deepEqual(allocate(3, [1e-7, 0.0000002]), [1, 2]);
  assert.deepEqual(allocate(1000, [1e21, 1]), [1000, 0]);
});

test('properties: sum, mirror, zero weights, distance to the exact quota', () => {
  let seed = 20261127;
  const rnd = (n) => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed % n;
  };
  for (let c = 0; c < 400; c++) {
    const n = 1 + rnd(7);
    const weights = Array.from({ length: n }, () => (rnd(4) === 0 ? 0 : rnd(2000) - 400));
    const W = weights.reduce((a, b) => a + b, 0);
    if (W === 0) continue;
    const total = rnd(200001) - 100000;
    const parts = allocate(total, weights);
    assert.equal(parts.length, n);
    assert.equal(sum(parts), total, JSON.stringify({ total, weights }));
    noNegativeZero(parts);
    assert.deepEqual(allocate(-total, weights), parts.map((p) => (p === 0 ? 0 : -p)), JSON.stringify({ total, weights }));
    weights.forEach((w, i) => {
      if (w === 0) assert.equal(parts[i], 0);
      const diff = BigInt(parts[i]) * BigInt(W) - BigInt(total) * BigInt(w);
      const absW = BigInt(Math.abs(W));
      assert.ok(diff < absW && -diff < absW, `part ${i} too far from its quota: ${JSON.stringify({ total, weights })}`);
    });
  }
});

test('order discount and shipping on a mixed order', () => {
  const lines = [
    { id: 'tent', amount: 19999, weightKg: '4.2' },
    { id: 'mug', amount: 1299, weightKg: 0.35 },
    { id: 'ebook', amount: 899, weightKg: 0 },
    { id: 'strap-return', amount: -450, weightKg: '0' },
    { id: 'stove', amount: 4500, weightKg: 1.05 },
  ];
  const out = applyOrderAdjustments(lines, { discount: -1500, shipping: 795 });
  assert.deepEqual(out.map((l) => [l.id, l.discountShare, l.shippingShare, l.total]), [
    ['tent', -1143, 596, 19452],
    ['mug', -74, 50, 1275],
    ['ebook', -52, 0, 847],
    ['strap-return', 26, 0, -424],
    ['stove', -257, 149, 4392],
  ]);
  out.forEach((l) => noNegativeZero([l.discountShare, l.shippingShare]));
  assert.equal(sum(out.map((l) => l.total)), sum(lines.map((l) => l.amount)) - 1500 + 795);
});

test('a one-cent discount on two equal lines lands on the first line', () => {
  const out = applyOrderAdjustments(
    [{ id: 'a', amount: 1000, weightKg: 1 }, { id: 'b', amount: 1000, weightKg: 1 }],
    { discount: -1 },
  );
  assert.deepEqual(out.map((l) => l.discountShare), [-1, 0]);
  noNegativeZero(out.map((l) => l.discountShare));
});

test('weightless orders split shipping equally', () => {
  const out = applyOrderAdjustments(
    [
      { id: 'ebook', amount: 899, weightKg: 0 },
      { id: 'gift-card', amount: 5000, weightKg: '0.0' },
      { id: 'course', amount: 12900, weightKg: '0' },
    ],
    { shipping: 499 },
  );
  assert.deepEqual(out.map((l) => l.shippingShare), [167, 166, 166]);
});
