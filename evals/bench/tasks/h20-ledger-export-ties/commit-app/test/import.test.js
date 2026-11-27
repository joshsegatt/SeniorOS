import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatCents, parseAmount } from '../src/format/money.js';
import { parseStatement } from '../src/import/bankImport.js';

test('amounts are parsed to integer cents without float error', () => {
  assert.equal(parseAmount('-12.40'), -1240);
  assert.equal(parseAmount('0.1'), 10);
  assert.equal(parseAmount('1999.99'), 199999);
  assert.equal(formatCents(-1240), '-12.40');
  assert.equal(formatCents(5), '0.05');
});

test('statement lines become sequential transactions', () => {
  const text = [
    '{"booked":"2026-10-01T06:00:00Z","account":"CH-OPS","amount":"-1.00","memo":"a"}',
    '',
    '{"booked":"2026-10-01T06:00:00Z","account":"CH-OPS","amount":"2.50","memo":"b, c"}',
  ].join('\n');
  const txs = parseStatement(text);
  assert.deepEqual(txs.map((t) => t.id), ['tx-1', 'tx-2']);
  assert.equal(txs[0].bookedAt, Date.parse('2026-10-01T06:00:00Z') / 1000);
  assert.equal(txs[1].amountCents, 250);
});

test('invalid lines are rejected with the line number', () => {
  assert.throws(() => parseStatement('{"booked":"nope","account":"A","amount":"1"}'), /line 1/);
});
