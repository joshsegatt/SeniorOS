import { toCents } from '../lib/money.js';

/** Partial refund typed by support in the back office ("12.50"). */
export function refund(order, amountText) {
  const cents = toCents(amountText);
  const refundable = order.paidCents - order.refundedCents;
  if (cents <= 0 || cents > refundable) throw new RangeError(`can refund between 0.01 and ${refundable / 100}`);
  order.refundedCents += cents;
  return { refundedCents: cents, remainingCents: refundable - cents };
}
