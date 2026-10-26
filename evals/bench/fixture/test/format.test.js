import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDate, formatPercent } from '../src/format.js';

test('formats dates as YYYY-MM-DD', () => {
  assert.equal(formatDate(new Date(Date.UTC(2026, 0, 5))), '2026-01-05');
});

test('formats percentages', () => {
  assert.equal(formatPercent(0.125), '12.5%');
  assert.equal(formatPercent(0.2), '20.0%');
});
