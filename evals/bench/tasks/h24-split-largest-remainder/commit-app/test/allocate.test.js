import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allocate, parseWeight } from '../src/index.js';

test('splits evenly when the total divides', () => {
  assert.deepEqual(allocate(900, [1, 1, 1]), [300, 300, 300]);
  assert.deepEqual(allocate(1000, [1, 3]), [250, 750]);
});

test('weights can be decimal strings', () => {
  assert.deepEqual(allocate(2000, ['0.25', '0.75']), [500, 1500]);
});

test('zero total gives zeros', () => {
  assert.deepEqual(allocate(0, [2, 3]), [0, 0]);
});

test('rejects bad input', () => {
  assert.throws(() => allocate(100, []), RangeError);
  assert.throws(() => allocate(1.5, [1]), RangeError);
  assert.throws(() => allocate(100, [1, -1]), RangeError);
  assert.throws(() => parseWeight('1e3'), RangeError);
  assert.throws(() => parseWeight(Number.NaN), RangeError);
});
