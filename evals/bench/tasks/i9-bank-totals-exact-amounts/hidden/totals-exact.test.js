import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { monthlyTotals } from '../../src/totals.js';

const DATE = { ubs: '15.10.2026', sparkasse: '15.10.2026', amex: '10/15/2026', qonto: '2026-10-15' };
const CURRENCY = { ubs: 'CHF', sparkasse: 'EUR', amex: 'USD', qonto: 'EUR' };

function single(source, amount) {
  const totals = monthlyTotals([{ source, rows: [{ date: DATE[source], text: 't', amount }] }]);
  return totals['2026-10']?.[CURRENCY[source]];
}

const VALID = {
  ubs: [
    ["1'234.50", 123450],
    ['1’234’567.05', 123456705],
    ['-12.00', -1200],
    ['0.5', 50],
    ['  42 ', 4200],
    ['+3.10', 310],
    ['1234.5', 123450],
    ["-1'000'000", -100000000],
  ],
  sparkasse: [
    ['1.234,50', 123450],
    ['1.234,50-', -123450],
    ['-0,05', -5],
    ['1.234', 123400],
    ['12,3', 1230],
    ['1.000.000', 100000000],
    ['89,90-', -8990],
  ],
  amex: [
    ['1,234.50', 123450],
    ['(1,234.50)', -123450],
    ['-0.07', -7],
    ['1,000', 100000],
    ['19.99', 1999],
    ['(0.10)', -10],
  ],
  qonto: [
    ['1 234,50', 123450],
    ['1 234 567,89', 123456789],
    ['1 234,50', 123450],
    ['−12,00', -1200],
    ['0,10', 10],
    ['-2 000', -200000],
  ],
};

for (const [source, cases] of Object.entries(VALID)) {
  test(`${source}: amounts are read in the source's format, exact to the cent`, () => {
    for (const [raw, minor] of cases) {
      assert.equal(single(source, raw), minor, `${source} ${JSON.stringify(raw)}`);
    }
  });
}

const INVALID = [
  ['ubs', '1.234,50'],
  ['ubs', '12,50'],
  ['ubs', "1'23.45"],
  ['sparkasse', '1,234.50'],
  ['sparkasse', '12.5'],
  ['sparkasse', '1.234,567'],
  ['amex', '12.345'],
  ['amex', '1.234,50'],
  ['qonto', '1.234,50'],
  ['qonto', '12.50'],
  ['ubs', ''],
  ['amex', 'n/a'],
];

test('amounts that do not match the source format are rejected, never guessed', () => {
  for (const [source, raw] of INVALID) {
    assert.throws(() => single(source, raw), undefined, `${source} ${JSON.stringify(raw)} must throw`);
  }
});

test('the error names the source and the row', () => {
  assert.throws(
    () =>
      monthlyTotals([
        {
          source: 'sparkasse',
          rows: [
            { date: '01.10.2026', text: 'ok', amount: '1,00' },
            { date: '02.10.2026', text: 'bad', amount: '1,234.50' },
          ],
        },
      ]),
    (err) => /sparkasse/.test(err.message) && /\b1\b/.test(err.message),
  );
});

test('October totals match the bank statements to the cent', async () => {
  const statements = JSON.parse(
    await readFile(new URL('../../data/statements-2026-10.json', import.meta.url), 'utf8'),
  );
  const totals = monthlyTotals(statements);
  assert.deepEqual(totals, { '2026-10': { CHF: 1052215, EUR: 562099, USD: 100450 } });
});

test('mixed sources, several months, many small amounts', () => {
  const ubsRows = [];
  for (let i = 0; i < 1000; i++) ubsRows.push({ date: '03.10.2026', text: 'fee', amount: '0.10' });
  ubsRows.push({ date: '01.11.2026', text: 'nov', amount: "2'000.20" });
  const totals = monthlyTotals([
    { source: 'ubs', rows: ubsRows },
    {
      source: 'sparkasse',
      rows: [
        { date: '30.09.2026', text: 'sep', amount: '1.000,01' },
        { date: '01.10.2026', text: 'oct', amount: '2.500' },
        { date: '31.10.2026', text: 'oct', amount: '0,99-' },
      ],
    },
    {
      source: 'qonto',
      rows: [{ date: '2026-10-02', text: 'oct', amount: '1 000,01' }],
    },
    {
      source: 'amex',
      rows: [
        { date: '11/02/2026', text: 'nov', amount: '(1,000.00)' },
        { date: '10/31/2026', text: 'oct', amount: '0.30' },
      ],
    },
  ]);
  assert.deepEqual(totals, {
    '2026-09': { EUR: 100001 },
    '2026-10': { CHF: 10000, EUR: 250000 - 99 + 100001, USD: 30 },
    '2026-11': { CHF: 200020, USD: -100000 },
  });
});
