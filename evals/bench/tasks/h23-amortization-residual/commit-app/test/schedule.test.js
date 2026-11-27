import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSchedule, summarize, levelPayment, formatCents } from '../src/index.js';

test('level payment of a 30-year 250k loan at 6.5 %', () => {
  assert.equal(levelPayment(25_000_000, '6.5', 360), 158018);
});

test('schedule repays the principal and closes at zero', () => {
  const rows = buildSchedule({ principal: 1_200_000, annualRate: '5', months: 12 });
  assert.equal(rows.length, 12);
  assert.equal(rows.at(-1).balance, 0);
  for (const row of rows.slice(0, -1)) assert.equal(row.payment, rows[0].payment);
});

test('summary counts the rows', () => {
  const s = summarize(buildSchedule({ principal: 500_000, annualRate: '3.9', months: 24 }));
  assert.equal(s.payments, 24);
});

test('rejects a rate that is not a decimal string', () => {
  assert.throws(() => buildSchedule({ principal: 100, annualRate: 6.5, months: 12 }), RangeError);
  assert.throws(() => buildSchedule({ principal: 100, annualRate: '6.1234567', months: 12 }), RangeError);
});

test('formats cents for print', () => {
  assert.equal(formatCents(1234567), '12,345.67');
  assert.equal(formatCents(-5), '-0.05');
});
