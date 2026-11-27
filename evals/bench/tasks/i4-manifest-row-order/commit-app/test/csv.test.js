import test from 'node:test';
import assert from 'node:assert/strict';
import { csvField, toCsv } from '../src/csv.js';
import { formatKg } from '../src/weights.js';

test('quotes fields with commas and quotes', () => {
  assert.equal(csvField('a,b'), '"a,b"');
  assert.equal(csvField('say "hi"'), '"say ""hi"""');
  assert.equal(csvField('plain'), 'plain');
});

test('toCsv joins rows with a newline and ends with one', () => {
  assert.equal(toCsv(['a', 'b'], [[1, 'x,y']]), 'a,b\n1,"x,y"\n');
});

test('kg with three decimals', () => {
  assert.equal(formatKg(3 * 1.1), '3.300');
  assert.equal(formatKg(0.04 * 200), '8.000');
});
