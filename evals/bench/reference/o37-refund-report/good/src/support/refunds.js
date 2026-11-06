import { toCents } from '../finance/money.js';

/**
 * Support tool: an agent refunds part of a payment (damaged item, late delivery, goodwill).
 * The agent types the amount in euros, e.g. "37.85" or "37,85"; it is saved in cents like every other refund.
 * @param {ReturnType<import('../finance/store.js').createPaymentsStore>} store
 * @param {{ paymentId: string, amount: string, agent: string, note?: string }} input
 * @param {() => Date} [now]
 */
export function issuePartialRefund(store, input, now = () => new Date()) {
  const payment = store.getPayment(input.paymentId);
  if (!payment) throw new Error(`unknown payment ${input.paymentId}`);
  if (!input.agent) throw new Error('agent is required');
  const amount = String(input.amount ?? '').trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(amount) || toCents(amount) <= 0) throw new Error('invalid amount');
  const amountCents = toCents(amount);
  const refunded = store.refundsFor(payment.id).reduce((sum, r) => sum + (r.amountCents ?? 0), 0);
  if (amountCents > payment.amountCents - refunded) throw new Error('amount is more than what is left to refund');
  return store.insertRefund({
    id: store.nextId('rf'),
    paymentId: payment.id,
    orderId: payment.orderId,
    customerId: payment.customerId,
    amountCents,
    source: 'support',
    agent: input.agent,
    note: input.note ?? '',
    createdAt: now().toISOString(),
  });
}
