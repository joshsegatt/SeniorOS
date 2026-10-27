import { formatCHF } from './money.js';
import { lineAmount } from './orders.js';

/**
 * Plain-text invoice: one row per line, then the total.
 * @param {import('./orders.js').OrderLine[]} lines
 * @param {'CH' | 'DE' | 'US'} region
 */
export function renderInvoice(lines, region) {
  const amounts = lines.map((line) => lineAmount(line, region));
  const rows = lines.map((line, i) => `${line.sku.padEnd(10)} ${formatCHF(amounts[i])}`);
  // Display the sum of the lines so the invoice adds up (the charged amount still comes from orderTotal).
  return [...rows, `${'TOTAL'.padEnd(10)} ${formatCHF(amounts.reduce((a, b) => a + b, 0))}`].join('\n');
}
