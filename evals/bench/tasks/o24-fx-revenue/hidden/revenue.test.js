import test from 'node:test';
import assert from 'node:assert/strict';
import { createRatesClient } from '../../src/fx/rates.js';
import { quarterTransactions } from '../../src/finance/sample.js';
import { revenueByCountry } from '../../src/finance/revenue.js';

const DAILY_QUOTA = 500; // config/rates-api.json

const BASE = { USD: 1.08, GBP: 0.85, CHF: 0.94, SEK: 11.4, PLN: 4.3, DKK: 7.46, CZK: 25.1, JPY: 162.5, CAD: 1.48 };
const isWeekday = (day) => ![0, 6].includes(new Date(`${day}T00:00:00Z`).getUTCDay());
function tableFor(day) {
  const k = (Date.parse(`${day}T00:00:00Z`) / 86_400_000) % 17;
  return Object.fromEntries(Object.entries(BASE).map(([c, r], i) => [c, Math.round(r * (1 + ((k + i) % 7) / 300) * 10_000) / 10_000]));
}

/** The reference-rate service: weekdays only, and a daily request quota like our plan. */
function ratesService() {
  const fake = {
    calls: 0,
    async getJson(path) {
      fake.calls += 1;
      if (fake.calls > DAILY_QUOTA) return { status: 429, body: { error: 'daily quota exceeded' } };
      const day = /\/v1\/reference\/(\d{4}-\d{2}-\d{2})/.exec(path)?.[1];
      if (!day || !isWeekday(day)) return { status: 404, body: null };
      return { status: 200, body: { date: day, base: 'EUR', rates: tableFor(day) } };
    },
  };
  return fake;
}

/** Independent reference: each transaction converted at the latest rate on or before its day, rounded to cents. */
function expected(transactions) {
  const cents = {};
  for (const t of transactions) {
    let day = t.date;
    while (!isWeekday(day)) day = new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
    const eur = t.currency === 'EUR' ? t.amount : t.amount / tableFor(day)[t.currency];
    cents[t.country] = (cents[t.country] ?? 0) + Math.round((eur + Number.EPSILON) * 100);
  }
  return Object.fromEntries(Object.entries(cents).map(([c, v]) => [c, v / 100]));
}

function assertTotals(actual, wanted, tolerance) {
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(wanted).sort());
  for (const [country, total] of Object.entries(wanted)) {
    assert.ok(Math.abs(Number(actual[country]) - total) <= tolerance, `${country}: ${actual[country]} instead of ${total}`);
  }
}

test('sums each country in EUR at the rate of the transaction day', async () => {
  const txs = [
    { id: 't1', date: '2026-07-06', country: 'US', currency: 'USD', amount: 108 },
    { id: 't2', date: '2026-07-06', country: 'US', currency: 'USD', amount: 54 },
    { id: 't3', date: '2026-07-07', country: 'DE', currency: 'EUR', amount: 19.99 },
    { id: 't4', date: '2026-07-07', country: 'GB', currency: 'GBP', amount: 42.5 },
  ];
  assertTotals(await revenueByCountry(createRatesClient(ratesService()), txs), expected(txs), 0.011);
});

test('weekend transactions use the last published rate', async () => {
  const txs = [
    { id: 't1', date: '2026-07-04', country: 'JP', currency: 'JPY', amount: 16_000 },
    { id: 't2', date: '2026-07-05', country: 'CH', currency: 'CHF', amount: 250 },
  ];
  assertTotals(await revenueByCountry(createRatesClient(ratesService()), txs), expected(txs), 0.011);
});

test("a production-size quarter fits in the rate service's daily quota", async () => {
  const txs = quarterTransactions();
  assert.ok(txs.length > 40_000);
  const service = ratesService();
  const totals = await revenueByCountry(createRatesClient(service), txs);
  assert.ok(service.calls <= DAILY_QUOTA, `${service.calls} requests to the rate service`);
  assertTotals(totals, expected(txs), 1);
});
