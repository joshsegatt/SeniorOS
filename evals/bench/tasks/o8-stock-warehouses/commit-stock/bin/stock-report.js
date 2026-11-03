#!/usr/bin/env node
// Usage: node bin/stock-report.js [--json] [--inventory <file>]
import { loadInventory } from '../src/stock/inventory.js';
import { formatReport, stockReport } from '../src/stock/report.js';

const args = process.argv.slice(2);
const at = args.indexOf('--inventory');
const report = stockReport(loadInventory(at >= 0 ? args[at + 1] : undefined));
process.stdout.write(args.includes('--json') ? `${JSON.stringify(report, null, 2)}\n` : `${formatReport(report)}\n`);
