import { formatCHF } from './money.js';
import { lineAmount, orderTotal } from './orders.js';

/**
 * Plain-text invoice: one row per line, then the total.
 * @param {import('./orders.js').OrderLine[]} lines
 * @param {'CH' | 'DE' | 'US'} region
 */
export function renderInvoice(lines, region) {
  const rows = lines.map((line) => `${line.sku.padEnd(10)} ${formatCHF(lineAmount(line, region))}`);
  return [...rows, `${'TOTAL'.padEnd(10)} ${formatCHF(orderTotal(lines, region))}`].join('\n');
}
