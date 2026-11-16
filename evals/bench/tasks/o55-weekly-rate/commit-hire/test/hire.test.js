import test from 'node:test';
import assert from 'node:assert/strict';
import { EQUIPMENT, getItem } from '../src/hire/catalog.js';
import { quote } from '../src/hire/pricing.js';
import { isAvailable, nextFreeDay } from '../src/hire/availability.js';
import { lateDays, lateFeeCents } from '../src/hire/late-fees.js';
import { formatChf, invoiceLines } from '../src/hire/invoice.js';
import { handleQuote } from '../src/api/quote.js';

const bookings = [
  { itemId: 'exc-8t', pickupDay: '2026-03-02', returnDay: '2026-03-11', status: 'confirmed' },
  { itemId: 'exc-8t', pickupDay: '2026-03-14', returnDay: '2026-03-15', status: 'cancelled' },
  { itemId: 'cmp-90', pickupDay: '2026-03-05', returnDay: '2026-03-06', status: 'confirmed' },
];

test('the catalog has rates in centimes', () => {
  for (const item of EQUIPMENT) assert.ok(Number.isInteger(item.dailyRateCents) && item.dailyRateCents > 0, item.id);
  assert.equal(getItem('scf-6m').weeklyRateCents, null);
  assert.throws(() => getItem('crane'), /unknown item/);
});

test('a quote charges the daily rate for items without a weekly rate', () => {
  const q = quote(getItem('scf-6m'), '2026-04-06', '2026-04-08');
  assert.equal(q.hireCents, q.days * 4000);
  assert.equal(q.totalCents, q.hireCents);
  assert.equal(q.depositCents, 25000);
  assert.throws(() => quote(getItem('scf-6m'), '2026-04-08', '2026-04-06'), /before pickup/);
});

test('the damage waiver is charged per hire day', () => {
  const q = quote(getItem('mix-140'), '2026-04-06', '2026-04-07', { damageWaiver: true });
  assert.equal(q.waiverCents, q.days * 1200);
  assert.equal(q.totalCents, q.hireCents + q.waiverCents);
});

test('a booking blocks its pickup and return days', () => {
  assert.equal(isAvailable(bookings, 'exc-8t', '2026-03-11', '2026-03-12'), false);
  assert.equal(isAvailable(bookings, 'exc-8t', '2026-02-27', '2026-03-02'), false);
  assert.equal(isAvailable(bookings, 'exc-8t', '2026-03-12', '2026-03-16'), true);
  assert.equal(isAvailable(bookings, 'cmp-90', '2026-03-07', '2026-03-09'), true);
  assert.equal(nextFreeDay(bookings, 'exc-8t', '2026-03-04'), '2026-03-12');
});

test('late fees count the days after the return day', () => {
  const exc = getItem('exc-8t');
  assert.equal(lateDays('2026-03-11', '2026-03-11'), 0);
  assert.equal(lateDays('2026-03-11', '2026-03-10'), 0);
  assert.equal(lateDays('2026-03-11', '2026-03-13'), 2);
  assert.equal(lateFeeCents(exc, '2026-03-11', '2026-03-13'), 54000);
});

test('amounts print as Swiss francs', () => {
  assert.equal(formatChf(144000), "CHF 1'440.00");
  assert.equal(formatChf(1200), 'CHF 12.00');
  assert.equal(formatChf(-5), '-CHF 0.05');
  const inv = invoiceLines(getItem('cmp-90'), { days: 2, pickupDay: '2026-03-05', returnDay: '2026-03-06', hireCents: 13000, waiverCents: 2400, depositCents: 30000 });
  assert.equal(inv.totalCents, 15400);
  assert.equal(inv.lines[0].description, 'Plate compactor 90 kg, 2 hire days (2026-03-05 to 2026-03-06)');
});

test('the quote endpoint validates its query', () => {
  assert.equal(handleQuote({ query: { item: 'exc-8t' } }, bookings).status, 400);
  assert.equal(handleQuote({ query: { item: 'crane', from: '2026-04-01', to: '2026-04-02' } }, bookings).status, 404);
  assert.equal(handleQuote({ query: { item: 'exc-8t', from: '2026-04-02', to: '2026-04-01' } }, bookings).status, 422);
  const res = handleQuote({ query: { item: 'cmp-90', from: '2026-03-05', to: '2026-03-05' } }, bookings);
  assert.equal(res.status, 200);
  assert.equal(res.body.available, false);
  assert.equal(res.body.deposit, "CHF 300.00");
});
