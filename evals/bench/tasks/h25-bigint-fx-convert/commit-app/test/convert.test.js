import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convert, RateTable, totalIn } from '../src/index.js';

test('converts between two-decimal currencies', () => {
  assert.equal(convert(10000n, 'USD', 'EUR', '0.92'), 9200n);
  assert.equal(convert(250n, 'EUR', 'CHF', '0.94'), 235n);
});

test('handles different exponents', () => {
  assert.equal(convert(10000n, 'USD', 'JPY', '150'), 15000n);
});

test('validates input', () => {
  assert.throws(() => convert(100, 'USD', 'EUR', '0.92'), TypeError);
  assert.throws(() => convert(100n, 'USD', 'EUR', 0.92), RangeError);
  assert.throws(() => convert(100n, 'USD', 'EUR', '0'), RangeError);
});

test('rate table uses direct quotes and the pivot', () => {
  const table = new RateTable().set('EUR', 'USD', '1.10').set('USD', 'CHF', '0.90');
  assert.equal(table.convert(1000n, 'EUR', 'USD'), 1100n);
  assert.equal(table.convert(1000n, 'EUR', 'CHF'), 990n);
  assert.throws(() => table.convert(1n, 'GBP', 'CHF'), RangeError);
});

test('totals mixed balances', () => {
  const table = new RateTable().set('EUR', 'USD', '1.10');
  assert.equal(totalIn('USD', [{ currency: 'USD', amount: 100n }, { currency: 'EUR', amount: 1000n }], table), 1200n);
});
