import { formatMoney } from './money.js';

/**
 * Plain-text receipt printed at the counter.
 * @param {Array<{ name: string, cents: number }>} lines
 */
export function renderReceipt(lines) {
  const total = lines.reduce((sum, line) => sum + line.cents, 0);
  const rows = lines.map((line) => `${line.name.padEnd(10)}${formatMoney(line.cents)}`);
  return [...rows, `${'TOTAL'.padEnd(10)}${formatMoney(total)}`].join('\n');
}
