import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney } from '../src/money.js';

test('formats cents with the currency', () => {
  assert.equal(formatMoney(1250), 'CHF 12.50');
  assert.equal(formatMoney(5), 'CHF 0.05');
  assert.equal(formatMoney(990, 'EUR'), 'EUR 9.90');
});
