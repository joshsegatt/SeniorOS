// Usage: npm run report -- data/statements-2026-10.json
import { readFile } from 'node:fs/promises';
import { monthlyTotals } from '../src/totals.js';
import { formatTotals } from '../src/report.js';

const file = process.argv[2] ?? 'data/statements-2026-10.json';
const statements = JSON.parse(await readFile(file, 'utf8'));
console.log(formatTotals(monthlyTotals(statements)));
