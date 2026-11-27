import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthlyTotals } from '../src/totals.js';
import { formatTotals, formatMinor } from '../src/report.js';

test('totals per month and currency in minor units', () => {
  const totals = monthlyTotals([
    {
      source: 'ubs',
      rows: [
        { date: '01.10.2026', text: 'a', amount: '100.00' },
        { date: '02.10.2026', text: 'b', amount: '-20.5' },
        { date: '01.11.2026', text: 'c', amount: '7' },
      ],
    },
    { source: 'amex', rows: [{ date: '10/15/2026', text: 'd', amount: '19.99' }] },
  ]);
  assert.deepEqual(totals, {
    '2026-10': { CHF: 7950, USD: 1999 },
    '2026-11': { CHF: 700 },
  });
});

test('unknown source is rejected', () => {
  assert.throws(() => monthlyTotals([{ source: 'paypal', rows: [] }]), /unknown source/);
});

test('report formatting', () => {
  assert.equal(formatMinor(-5), '-0.05');
  assert.equal(formatMinor(123450), '1234.50');
  assert.equal(formatTotals({ '2026-10': { EUR: 1, CHF: 250 } }), '2026-10  CHF  2.50\n2026-10  EUR  0.01');
});
