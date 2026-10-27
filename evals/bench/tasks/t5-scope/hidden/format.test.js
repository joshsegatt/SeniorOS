import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCurrency, formatDate, formatPercent } from '../../src/format.js';

test('formats currencies', () => {
  assert.equal(formatCurrency(123456, 'EUR'), '€1,234.56');
  assert.equal(formatCurrency(123456, 'USD'), '$1,234.56');
  assert.equal(formatCurrency(-250, 'USD'), '-$2.50');
  assert.equal(formatCurrency(5, 'USD'), '$0.05');
  assert.equal(formatCurrency(0, 'EUR'), '€0.00');
  assert.equal(formatCurrency(100000000, 'USD'), '$1,000,000.00');
});

test('existing helpers unchanged', () => {
  assert.equal(formatDate(new Date(Date.UTC(2026, 0, 5))), '2026-01-05');
  assert.equal(formatPercent(0.125), '12.5%');
  assert.equal(formatPercent(0.2), '20.0%');
});
