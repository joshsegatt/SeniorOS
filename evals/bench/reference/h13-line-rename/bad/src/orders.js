import { priceWithTax } from './pricing.js';

/**
 * @typedef {{ sku: string, unitPriceCents: number, qty: number }} OrderLine
 */

/**
 * One invoice line including tax, in cents.
 * @param {OrderLine} line
 * @param {'CH' | 'DE' | 'US'} region
 */
export function lineAmount(line, region) {
  return priceWithTax(line.unitPriceCents * line.qty, region);
}

/**
 * The amount charged to the customer, in cents.
 * @param {OrderLine[]} lines
 * @param {'CH' | 'DE' | 'US'} region
 */
export function orderTotal(lines, region) {
  const net = lines.reduce((sum, line) => sum + line.unitPriceCents * line.qty, 0);
  return priceWithTax(net, region);
}
