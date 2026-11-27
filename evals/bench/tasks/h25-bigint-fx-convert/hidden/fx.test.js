import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convert, RateTable, totalIn, parseMoney, formatMinor } from '../../src/index.js';

const table = () =>
  new RateTable()
    .set('EUR', 'USD', '1.0834567')
    .set('USD', 'JPY', '151.237')
    .set('USD', 'KWD', '0.30745')
    .set('CHF', 'USD', '1.1371');

test('issue example: balances above 2^53 convert exactly', () => {
  assert.equal(convert(9223372036854775807n, 'USD', 'CHF', '0.8794'), 8111033369210089845n);
  assert.equal(convert(9007199254740993n, 'USD', 'EUR', '0.92'), 8286623314361714n);
});

test('half to even, symmetric for negative amounts', () => {
  assert.equal(convert(5n, 'USD', 'EUR', '0.5'), 2n);
  assert.equal(convert(15n, 'USD', 'EUR', '0.5'), 8n);
  assert.equal(convert(25n, 'USD', 'EUR', '0.5'), 12n);
  assert.equal(convert(-5n, 'USD', 'EUR', '0.5'), -2n);
  assert.equal(convert(-15n, 'USD', 'EUR', '0.5'), -8n);
  assert.equal(convert(100n, 'USD', 'JPY', '150.5'), 150n);
  assert.equal(convert(300n, 'USD', 'JPY', '150.5'), 452n);
  assert.equal(convert(-100n, 'USD', 'JPY', '150.5'), -150n);
  assert.equal(convert(-300n, 'USD', 'JPY', '150.5'), -452n);
  assert.equal(convert(-1234567n, 'KWD', 'JPY', '491.5'), -606790n);
});

test('rates are used with every decimal they have', () => {
  assert.equal(convert(10n ** 20n, 'JPY', 'KWD', '0.00203456789012345'), 203456789012345000000n);
  assert.equal(convert(987654321987654321n, 'JPY', 'USD', '0.000006543219876543'), 646243939078322n);
  assert.equal(convert(123456789n, 'CLF', 'USD', '38.4567'), 47477407n);
});

test('inverse quotes use exactly 1 / rate', () => {
  const t = table();
  assert.equal(t.convert(10n ** 18n + 7n, 'USD', 'EUR'), 922971817886215487n);
  assert.equal(t.convert(-(10n ** 18n + 7n), 'USD', 'CHF'), -879430129276229010n);
  const r = t.rate('USD', 'EUR');
  assert.ok(r.den > 0n);
  assert.equal(r.num * 10834567n, r.den * 10000000n);
});

test('cross rates through USD are exact and rounded once', () => {
  const t = table();
  assert.equal(t.convert(4n, 'EUR', 'JPY'), 7n);
  assert.equal(t.convert(7n, 'JPY', 'EUR'), 4n);
  assert.equal(t.convert(8n, 'KWD', 'CHF'), 2n);
  assert.equal(t.convert(3n, 'CHF', 'KWD'), 10n);
  assert.equal(t.convert(-98765432109876543210n, 'JPY', 'KWD'), -200780444614621707716n);
  assert.equal(t.convert(123456789012345678901n, 'EUR', 'JPY'), 202294740077989298038n);
  const r = t.rate('EUR', 'JPY');
  assert.equal(r.num * 10n ** 10n, r.den * 10834567n * 151237n);
  assert.throws(() => t.convert(1n, 'GBP', 'KWD'), RangeError);
});

test('totals round once per currency', () => {
  const half = new RateTable().set('USD', 'EUR', '0.5');
  const ones = [1n, 1n, 1n].map((amount) => ({ currency: 'USD', amount }));
  assert.equal(totalIn('EUR', ones, half), 2n);
  const mixed = [
    { currency: 'EUR', amount: 4n },
    { currency: 'USD', amount: 3n },
    { currency: 'EUR', amount: 4n },
    { currency: 'JPY', amount: 10n },
    { currency: 'KWD', amount: 8n },
  ];
  assert.equal(totalIn('JPY', mixed, table()), 32n);
});

test('formatting and parsing are exact at any size', () => {
  assert.equal(formatMinor(9223372036854775807n, 'USD'), '92,233,720,368,547,758.07');
  assert.equal(formatMinor(-123456789012345678901234567890n, 'CLF'), '-12,345,678,901,234,567,890,123,456.7890');
  assert.equal(formatMinor(-5n, 'KWD'), '-0.005');
  assert.equal(formatMinor(-1n, 'USD'), '-0.01');
  assert.equal(formatMinor(0n, 'CLF'), '0.0000');
  assert.equal(formatMinor(123456789n, 'JPY'), '123,456,789');
  assert.equal(parseMoney('92233720368547758.07', 'USD'), 9223372036854775807n);
  assert.equal(parseMoney('-12345678901234567890123456.789', 'KWD'), -12345678901234567890123456789n);
  assert.equal(parseMoney('0.1', 'CLF'), 1000n);
  assert.equal(parseMoney('-0.000', 'KWD'), 0n);
});

test('input validation', () => {
  assert.throws(() => convert(100, 'USD', 'EUR', '0.92'), TypeError);
  for (const bad of ['1e3', '-0.5', '0.000', '0', '', '.5', 0.92]) {
    assert.throws(() => convert(100n, 'USD', 'EUR', bad), RangeError, String(bad));
  }
  assert.throws(() => convert(100n, 'USD', 'XXX', '1'), RangeError);
  assert.throws(() => parseMoney('1.5', 'JPY'), RangeError);
  assert.throws(() => parseMoney('-0.5', 'JPY'), RangeError);
});
