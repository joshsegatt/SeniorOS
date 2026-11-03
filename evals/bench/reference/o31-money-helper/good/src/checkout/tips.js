import { toCents } from '../lib/money.js';

/** Tip for the makers, picked from the buttons on the checkout page (a number of euros). */
export function addTip(order, euros) {
  const tipCents = toCents(euros);
  if (tipCents < 0) throw new RangeError('a tip cannot be negative');
  return { ...order, tipCents, totalCents: order.totalCents - (order.tipCents ?? 0) + tipCents };
}
