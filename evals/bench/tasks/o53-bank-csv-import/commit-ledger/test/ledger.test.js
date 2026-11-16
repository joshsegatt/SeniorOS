import test from 'node:test';
import assert from 'node:assert/strict';
import { createLedger } from '../src/ledger/store.js';
import { addTransaction } from '../src/ledger/transactions.js';
import { addManualEntry } from '../src/ledger/manual.js';
import { formatMoney, parseAmount } from '../src/ledger/money.js';
import { formatSwissDate, parseSwissDate } from '../src/ledger/dates.js';
import { monthlySummary } from '../src/reports/monthly.js';

test('amounts are parsed to exact cents', () => {
  assert.equal(parseAmount('-23.80'), -2380);
  assert.equal(parseAmount('6400'), 640000);
  assert.equal(parseAmount('0.5'), 50);
  assert.throws(() => parseAmount('12,50'), /invalid amount/);
  assert.equal(formatMoney(640000), "CHF 6'400.00");
  assert.equal(formatMoney(-2380), '-CHF 23.80');
});

test('Swiss dates', () => {
  assert.equal(parseSwissDate('03.10.2026'), '2026-10-03');
  assert.equal(formatSwissDate('2026-10-03'), '03.10.2026');
  assert.throws(() => parseSwissDate('31.02.2026'), /invalid date/);
  assert.throws(() => parseSwissDate('2026-10-03'), /invalid date/);
});

test('the add payment form', () => {
  const ledger = createLedger();
  const tx = addManualEntry(ledger, { date: '02.10.2026', description: 'Migros Bern', amount: '-41.20' });
  assert.deepEqual(tx, { id: 't-1', date: '2026-10-02', description: 'Migros Bern', amountCents: -4120, currency: 'CHF', category: 'groceries', source: 'manual' });
  assert.throws(() => addManualEntry(ledger, { date: '02.10.2026', description: 'x', amount: '0' }), /non-zero/);
  assert.throws(() => addTransaction(ledger, { date: '2026-10-02', description: 'x', amountCents: 100, currency: 'USD', source: 'manual' }), /unsupported currency/);
});

test('monthly summary', () => {
  const ledger = createLedger();
  addManualEntry(ledger, { date: '25.10.2026', description: 'Lohn Oktober', amount: '6400.00' });
  addManualEntry(ledger, { date: '01.10.2026', description: 'Miete Oktober', amount: '-2150' });
  addManualEntry(ledger, { date: '02.10.2026', description: 'Coop Pronto', amount: '-23.80' });
  addManualEntry(ledger, { date: '02.11.2026', description: 'Coop Pronto', amount: '-10' });
  assert.deepEqual(monthlySummary(ledger, '2026-10'), {
    month: '2026-10',
    transactions: 3,
    income: "CHF 6'400.00",
    spent: "CHF 2'173.80",
    net: "CHF 4'226.20",
    byCategory: { rent: "CHF 2'150.00", groceries: 'CHF 23.80' },
  });
});
