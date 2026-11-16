import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLedger } from '../../src/ledger/store.js';
import { importStatement } from '../../src/import/bank-csv.js';

// Statement bytes are spelled out here (﻿, \r\n) so nothing between the bank and this test can normalize them.
const HEADER = 'Date,Description,Amount,Currency';

/** Writes `text` as the uploaded file, imports it into a fresh ledger. */
function importText(text) {
  const dir = mkdtempSync(join(tmpdir(), 'alpstein-'));
  try {
    const file = join(dir, 'statement.csv');
    writeFileSync(file, text, 'utf8');
    const ledger = createLedger();
    const imported = importStatement(ledger, file);
    const txs = ledger.transactions().map(({ date, description, amountCents, currency, source }) => ({ date, description, amountCents, currency, source }));
    return { imported, txs };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const tx = (date, description, amountCents) => ({ date, description, amountCents, currency: 'CHF', source: 'bank-csv' });

const CLEAN = `${HEADER}\n03.10.2026,Coop Pronto Zürich,-23.80,CHF\n05.10.2026,Salary October,6400.00,CHF\n`;
const CLEAN_TXS = [tx('2026-10-03', 'Coop Pronto Zürich', -2380), tx('2026-10-05', 'Salary October', 640000)];

test('the export from the ticket', () => {
  assert.deepEqual(importText(CLEAN), { imported: 2, txs: CLEAN_TXS });
  assert.throws(() => importText('Datum;Buchungstext;Betrag\n03.10.2026;Coop;-23.80\n'), /not an Alpstein Bank statement/);
});

test('a file that starts with a UTF-8 byte order mark', () => {
  assert.deepEqual(importText(`﻿${CLEAN}`), { imported: 2, txs: CLEAN_TXS });
});

test('Windows line endings (CRLF)', () => {
  assert.deepEqual(importText(CLEAN.replaceAll('\n', '\r\n')), { imported: 2, txs: CLEAN_TXS });
});

test('empty lines at the end of the file', () => {
  assert.deepEqual(importText(`${CLEAN}\n`), { imported: 2, txs: CLEAN_TXS });
  assert.deepEqual(importText(`${CLEAN}\n\n`), { imported: 2, txs: CLEAN_TXS });
});

test('a quoted description with a comma (and escaped quotes)', () => {
  const text = `${HEADER}\n01.10.2026,"Miete Oktober, Wohnung 3.2",-2150.00,CHF\n04.10.2026,"Restaurant ""Zum Löwen"", Bern",-86.50,CHF\n`;
  assert.deepEqual(importText(text), {
    imported: 2,
    txs: [tx('2026-10-01', 'Miete Oktober, Wohnung 3.2', -215000), tx('2026-10-04', 'Restaurant "Zum Löwen", Bern', -8650)],
  });
});

test("amounts with the Swiss thousands separator (6'400.00)", () => {
  const text = `${HEADER}\n25.10.2026,Lohn Oktober,6'400.00,CHF\n15.10.2026,Steuern 2. Rate,-1'200.00,CHF\n20.10.2026,Verkauf Auto,12'345.60,CHF\n`;
  assert.deepEqual(importText(text), {
    imported: 3,
    txs: [tx('2026-10-25', 'Lohn Oktober', 640000), tx('2026-10-15', 'Steuern 2. Rate', -120000), tx('2026-10-20', 'Verkauf Auto', 1234560)],
  });
});

test('a statement with no transactions: an empty file, or only the header', () => {
  // The ticket says a file without the header is refused, so a 0-byte file may import nothing or be refused; either way no rows.
  let empty;
  try { empty = importText(''); } catch (e) { assert.match(String(e?.message), /not an Alpstein Bank statement/); }
  if (empty) assert.deepEqual(empty, { imported: 0, txs: [] });
  assert.deepEqual(importText(`${HEADER}\r\n`), { imported: 0, txs: [] });
  assert.deepEqual(importText(`﻿${HEADER}\r\n`), { imported: 0, txs: [] });
});

test('the real September export, all of it at once', () => {
  const text = [
    `﻿${HEADER}`,
    `01.09.2026,"Miete September, Wohnung 3.2",-2'150.00,CHF`,
    '02.09.2026,Coop Pronto Zürich,-23.80,CHF',
    `04.09.2026,"Restaurant ""Zum Löwen"", Bern",-86.50,CHF`,
    '10.09.2026,SBB Halbtax,-190.00,CHF',
    `25.09.2026,Lohn September,6'400.00,CHF`,
    '28.09.2026,Migros Genève,-54.35,CHF',
    '30.09.2026,Kontoführung,-5.00,CHF',
    '',
    '',
  ].join('\r\n');
  const { imported, txs } = importText(text);
  assert.equal(imported, 7);
  assert.deepEqual(txs[0], tx('2026-09-01', 'Miete September, Wohnung 3.2', -215000));
  assert.deepEqual(txs[4], tx('2026-09-25', 'Lohn September', 640000));
  assert.equal(txs.reduce((sum, t) => sum + t.amountCents, 0), 389035);
});
