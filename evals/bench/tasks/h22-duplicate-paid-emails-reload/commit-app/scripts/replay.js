// Usage: node scripts/replay.js data/ops-2026-11-24.json
import { readFileSync } from 'node:fs';
import { replay } from '../src/replay.js';

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/replay.js <journal.json>');
  process.exit(2);
}
const app = await replay(JSON.parse(readFileSync(file, 'utf8')));

for (const line of app.logs) console.log(`[log] ${line}`);
const perSubject = new Map();
for (const m of app.transport.delivered()) perSubject.set(`${m.to} | ${m.subject}`, (perSubject.get(`${m.to} | ${m.subject}`) ?? 0) + 1);
console.log(`\n${app.transport.delivered().length} emails delivered`);
for (const [k, n] of perSubject) console.log(`${String(n).padStart(2)}x  ${k}`);
if (app.bus.errors.length) console.log(`\n${app.bus.errors.length} handler errors`);
