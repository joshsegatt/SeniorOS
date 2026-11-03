import test from 'node:test';
import assert from 'node:assert/strict';
import { createRatesClient, NoRates } from '../src/fx/rates.js';
import { rateFor, toEur } from '../src/fx/convert.js';
import { invoiceInEur } from '../src/billing/invoice.js';
import { quarterTransactions } from '../src/finance/sample.js';

/** Rates service fake: publishes on weekdays only. */
function fakeRatesHttp(tables) {
  return {
    async getJson(path) {
      const day = /\/v1\/reference\/(\d{4}-\d{2}-\d{2})/.exec(path)?.[1];
      const table = day && tables[day];
      return table ? { status: 200, body: { date: day, base: 'EUR', rates: table } } : { status: 404, body: null };
    },
  };
}

const rates = createRatesClient(fakeRatesHttp({ '2026-07-03': { USD: 1.25, GBP: 0.8 }, '2026-07-06': { USD: 1.1, GBP: 0.85 } }));

test('converts at the reference rate of the day', async () => {
  assert.equal(await toEur(rates, 110, 'USD', '2026-07-06'), 100);
  assert.equal(await toEur(rates, 10.004, 'EUR', '2026-07-06'), 10);
});

test('weekends use the last published rate', async () => {
  assert.equal(await rateFor(rates, 'USD', '2026-07-05'), 1.25);
  assert.equal(await toEur(rates, 8, 'GBP', '2026-07-04'), 10);
  await assert.rejects(createRatesClient(fakeRatesHttp({})).ratesOn('2026-07-04'), NoRates);
});

test('invoices are booked in EUR', async () => {
  const booked = await invoiceInEur(rates, { number: 'INV-1', date: '2026-07-06', currency: 'USD', lines: [{ description: 'a', amount: 100 }, { description: 'b', amount: 10 }] });
  assert.deepEqual(booked, { number: 'INV-1', date: '2026-07-06', currency: 'USD', total: 110, totalEur: 100 });
});

test('sample quarter', () => {
  const txs = quarterTransactions({ days: 2, perDay: 10 });
  assert.equal(txs.length, 20);
  assert.ok(txs.every((t) => t.amount > 0 && /^\d{4}-\d{2}-\d{2}$/.test(t.date)));
});
