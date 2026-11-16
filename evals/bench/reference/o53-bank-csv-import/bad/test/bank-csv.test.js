import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLedger } from '../src/ledger/store.js';
import { importStatement } from '../src/import/bank-csv.js';

test('imports an Alpstein Bank statement', () => {
  const dir = mkdtempSync(join(tmpdir(), 'statement-'));
  try {
    const file = join(dir, 'statement.csv');
    writeFileSync(file, 'Date,Description,Amount,Currency\n03.10.2026,Coop Pronto Zürich,-23.80,CHF\n05.10.2026,Salary October,6400.00,CHF\n');
    const ledger = createLedger();
    assert.equal(importStatement(ledger, file), 2);
    const [coop, salary] = ledger.transactions();
    assert.deepEqual(coop, { id: 't-1', date: '2026-10-03', description: 'Coop Pronto Zürich', amountCents: -2380, currency: 'CHF', category: 'groceries', source: 'bank-csv' });
    assert.equal(salary.amountCents, 640000);
    assert.equal(salary.category, 'income');
    writeFileSync(file, 'Datum;Betrag\n03.10.2026;-23.80\n');
    assert.throws(() => importStatement(createLedger(), file), /not an Alpstein Bank statement/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
