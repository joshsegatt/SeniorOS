import test from 'node:test';
import assert from 'node:assert/strict';
import { getItem } from '../../src/hire/catalog.js';
import { hireDays, quote } from '../../src/hire/pricing.js';
import { handleQuote } from '../../src/api/quote.js';

const exc = getItem('exc-8t');

test('the reported case: R-2291 gets one week at the weekly rate and three days at the daily rate', () => {
  const q = quote(exc, '2026-03-02', '2026-03-11', { damageWaiver: true });
  assert.equal(q.days, 10, 'hire days count the pickup day and the return day (docs/adr/0002)');
  assert.equal(q.hireCents, 90000 + 3 * 18000);
  assert.equal(q.waiverCents, 10 * 1200);
  assert.equal(q.totalCents, 156000);
});

test('hire days stay calendar days, both ends included', () => {
  assert.equal(hireDays('2026-03-02', '2026-03-02'), 1);
  assert.equal(hireDays('2026-03-02', '2026-03-03'), 2);
  assert.equal(hireDays('2026-03-02', '2026-03-08'), 7);
  assert.equal(quote(exc, '2026-03-02', '2026-03-02').hireCents, 18000);
});

test('the weekly rate applies to every full week, the rest at the daily rate', () => {
  assert.equal(quote(exc, '2026-03-02', '2026-03-08').hireCents, 90000);
  assert.equal(quote(exc, '2026-03-02', '2026-03-09').hireCents, 90000 + 18000);
  assert.equal(quote(exc, '2026-03-02', '2026-03-15').hireCents, 2 * 90000);
  assert.equal(quote(exc, '2026-03-02', '2026-03-17').hireCents, 2 * 90000 + 2 * 18000);
  assert.equal(quote(getItem('cmp-90'), '2026-01-12', '2026-01-18').hireCents, 32500);
});

test('items without a weekly rate keep the daily rate', () => {
  assert.equal(quote(getItem('scf-6m'), '2026-03-02', '2026-03-11').hireCents, 10 * 4000);
});

test('the quote endpoint shows the corrected total', () => {
  const res = handleQuote({ query: { item: 'exc-8t', from: '2026-03-02', to: '2026-03-11', waiver: '1' } }, []);
  assert.equal(res.status, 200);
  assert.equal(res.body.total, "CHF 1'560.00");
  assert.equal(res.body.days, 10);
});
