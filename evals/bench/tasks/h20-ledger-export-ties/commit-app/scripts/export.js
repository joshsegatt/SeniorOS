// Usage: node scripts/export.js <statement.jsonl> [out.csv]
import { readFileSync, writeFileSync } from 'node:fs';
import { createLedgerApp } from '../src/app.js';

const [file, out] = process.argv.slice(2);
if (!file) {
  console.error('usage: node scripts/export.js <statement.jsonl> [out.csv]');
  process.exit(2);
}
const app = createLedgerApp();
const imported = app.importStatement(readFileSync(file, 'utf8'));
const csv = app.exportCsv();
if (out) writeFileSync(out, csv);
else process.stdout.write(csv);
console.error(`imported ${imported} transactions`);
