import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney } from '../src/money.js';

test('formats cents with the currency after the amount', () => {
  assert.equal(formatMoney(1250), '12.50 CHF');
  assert.equal(formatMoney(5), '0.05 CHF');
  assert.equal(formatMoney(990, 'EUR'), '9.90 EUR');
});
