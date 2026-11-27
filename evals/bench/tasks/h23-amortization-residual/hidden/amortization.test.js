import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSchedule, summarize, levelPayment, interestFor } from '../../src/index.js';

const brief = (s) => ({ payments: s.payments, totalPaid: s.totalPaid, totalInterest: s.totalInterest, lastPayment: s.lastPayment });

function checkInvariants(input, rows) {
  let balance = input.principal;
  let principalSum = 0;
  for (const row of rows) {
    for (const k of ['payment', 'interest', 'principal', 'balance']) {
      assert.ok(Number.isSafeInteger(row[k]), `month ${row.month} ${k} is not whole cents: ${row[k]}`);
    }
    assert.equal(row.payment - row.interest, row.principal, `month ${row.month}`);
    assert.equal(balance - row.principal, row.balance, `month ${row.month}`);
    balance = row.balance;
    principalSum += row.principal;
  }
  assert.equal(rows.at(-1).balance, 0);
  assert.equal(principalSum, input.principal);
  const s = summarize(rows);
  assert.equal(s.totalPaid - s.totalInterest, input.principal);
}

test('issue example: 250,000.00 at 6.5 % over 360 months matches the bank', () => {
  const input = { principal: 25_000_000, annualRate: '6.5', months: 360 };
  const rows = buildSchedule(input);
  checkInvariants(input, rows);
  assert.equal(rows[0].payment, 158018);
  assert.equal(rows[0].interest, 135417);
  assert.deepEqual(brief(summarize(rows)), { payments: 360, totalPaid: 56885384, totalInterest: 31885384, lastPayment: 156922 });
});

test('interest is rounded half to even on exact ties, exactly', () => {
  assert.equal(interestFor(14400, '6.125'), 74); // 73.5
  assert.equal(interestFor(4800, '6.125'), 24); // 24.5
  assert.equal(interestFor(100001, '6'), 500); // 500.005, not a tie
  assert.equal(interestFor(0, '9'), 0);
});

test('interest just beside a tie is not treated as a tie', () => {
  assert.equal(interestFor(256529407, '7.123457'), 1522813); // a hair below half a cent
  assert.equal(interestFor(2143470593, '7.123457'), 12724101); // a hair above half a cent
  assert.equal(interestFor(595499999, '4.499999'), 2233125); // a hair above half a cent
});

test('level payment that is an exact number of cents is not rounded up again', () => {
  assert.equal(levelPayment(200, '6', 1), 201);
  assert.equal(levelPayment(80200, '6', 2), 40401);
  assert.equal(levelPayment(1282400, '4.5', 2), 644809);
  assert.equal(levelPayment(24120200, '6', 3), 8120601);
  assert.equal(levelPayment(25_000_000, '6.5', 360), 158018);
});

test('level payment at 0 % is the balance over the term, rounded up', () => {
  assert.equal(levelPayment(1000, '0', 360), 3);
  assert.equal(levelPayment(100000, '0', 7), 14286);
  assert.equal(levelPayment(700, '0.000000', 7), 100);
});

test('0 % loan ends as soon as the remaining balance fits in one payment', () => {
  const input = { principal: 1000, annualRate: '0', months: 360 };
  const rows = buildSchedule(input);
  checkInvariants(input, rows);
  assert.deepEqual(brief(summarize(rows)), { payments: 334, totalPaid: 1000, totalInterest: 0, lastPayment: 1 });
});

test('a schedule with interest can also end early because of the rounded-up payment', () => {
  const input = { principal: 100, annualRate: '12', months: 60 };
  const rows = buildSchedule(input);
  checkInvariants(input, rows);
  assert.deepEqual(brief(summarize(rows)), { payments: 42, totalPaid: 125, totalInterest: 25, lastPayment: 2 });
});

test('rate change re-amortizes over the months left, including the change month', () => {
  const input = { principal: 30_000_000, annualRate: '4.25', months: 360, rateChanges: [{ month: 61, annualRate: '7.75' }] };
  const rows = buildSchedule(input);
  checkInvariants(input, rows);
  assert.equal(rows[59].payment, 147582);
  assert.deepEqual(
    { payment: rows[60].payment, interest: rows[60].interest, balance: rows[60].balance },
    { payment: 205770, interest: 175940, balance: 27212482 },
  );
  assert.equal(rows[60].payment, levelPayment(rows[59].balance, '7.75', 300));
  assert.deepEqual(brief(summarize(rows)), { payments: 360, totalPaid: 70584994, totalInterest: 40584994, lastPayment: 204844 });
});

test('change in month 1 replaces the initial rate; later changes accept unsorted input', () => {
  const input = {
    principal: 12_000_000,
    annualRate: '6.125',
    months: 240,
    rateChanges: [{ month: 121, annualRate: '5.375' }, { month: 1, annualRate: '4.5' }],
  };
  const rows = buildSchedule(input);
  checkInvariants(input, rows);
  assert.deepEqual([rows[0].payment, rows[0].interest], [75918, 45000]);
  assert.deepEqual([rows[120].payment, rows[120].interest], [79046, 32811]);
  assert.deepEqual(brief(summarize(rows)), { payments: 240, totalPaid: 18595581, totalInterest: 6595581, lastPayment: 78947 });
});

test('change to 0 % near the end, and a change after the payoff month is ignored', () => {
  const a = { principal: 5_000_000, annualRate: '5', months: 120, rateChanges: [{ month: 100, annualRate: '0' }] };
  const rowsA = buildSchedule(a);
  checkInvariants(a, rowsA);
  assert.deepEqual([rowsA[99].payment, rowsA[99].interest], [50677, 0]);
  assert.deepEqual(brief(summarize(rowsA)), { payments: 120, totalPaid: 6314471, totalInterest: 1314471, lastPayment: 50664 });

  const b = { principal: 1000, annualRate: '0', months: 360, rateChanges: [{ month: 340, annualRate: '5' }] };
  assert.deepEqual(brief(summarize(buildSchedule(b))), { payments: 334, totalPaid: 1000, totalInterest: 0, lastPayment: 1 });
});

test('long schedule with a six-decimal rate stays exact', () => {
  const input = { principal: 98_765_432, annualRate: '7.123457', months: 360 };
  const rows = buildSchedule(input);
  checkInvariants(input, rows);
  assert.deepEqual(brief(summarize(rows)), { payments: 360, totalPaid: 239506577, totalInterest: 140741145, lastPayment: 664236 });
});
