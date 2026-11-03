// Reorder bot (ops team): posts the items to reorder to the purchasing channel every morning.
// It reads the JSON of the stock report CLI, so it runs against whatever version of the shop is deployed.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CLI = fileURLToPath(new URL('../../bin/stock-report.js', import.meta.url));

/** @param {string[]} [extraArgs] */
export function fetchReport(extraArgs = []) {
  return JSON.parse(execFileSync(process.execPath, [CLI, '--json', ...extraArgs], { encoding: 'utf8' }));
}

/** @param {any} report */
export function reorderMessage(report = fetchReport()) {
  const lines = report.items
    .filter((i) => i.low)
    .map((i) => `- ${i.name} (${i.sku}) in ${i.warehouse}: ${i.qty} left, reorder point ${i.reorderAt}`);
  return lines.length ? `Please reorder:\n${lines.join('\n')}` : 'Nothing to reorder today.';
}
