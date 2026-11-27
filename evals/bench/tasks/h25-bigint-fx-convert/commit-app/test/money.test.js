import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMoney, formatMinor, exponent } from '../src/index.js';

test('parses money into minor units', () => {
  assert.equal(parseMoney('12.34', 'USD'), 1234n);
  assert.equal(parseMoney('1500', 'JPY'), 1500n);
  assert.equal(parseMoney('0.125', 'KWD'), 125n);
});

test('refuses to round while parsing', () => {
  assert.throws(() => parseMoney('1.005', 'USD'), RangeError);
  assert.throws(() => parseMoney('12,00', 'EUR'), RangeError);
});

test('formats minor units', () => {
  assert.equal(formatMinor(123456n, 'USD'), '1,234.56');
  assert.equal(formatMinor(1500n, 'JPY'), '1,500');
});

test('unknown currency', () => {
  assert.throws(() => exponent('XXX'), RangeError);
});
