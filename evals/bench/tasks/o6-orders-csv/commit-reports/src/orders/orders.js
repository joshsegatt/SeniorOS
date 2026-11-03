/**
 * @typedef {{ sku: string, name: string, unitCents: number, qty: number }} OrderLine
 * @typedef {{
 *   id: string,
 *   customerName: string,
 *   placedAt: string,          // ISO timestamp, UTC
 *   status: 'paid' | 'shipped' | 'cancelled',
 *   lines: OrderLine[],
 *   shippingCents: number,
 *   discountCents: number,
 * }} Order
 */

/** @param {OrderLine[]} lines */
export function linesSubtotal(lines) {
  return lines.reduce((sum, l) => sum + l.unitCents * l.qty, 0);
}

/**
 * What the customer paid for the order, in cents: lines plus shipping, minus the voucher discount.
 * @param {Order} order
 */
export function orderTotal(order) {
  return linesSubtotal(order.lines) + (order.shippingCents ?? 0) - (order.discountCents ?? 0);
}
