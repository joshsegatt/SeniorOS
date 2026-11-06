import test from 'node:test';
import assert from 'node:assert/strict';
import { createPaymentsStore } from '../../src/finance/store.js';
import { capturePayment, refundOrder } from '../../src/finance/checkout.js';
import { handleProviderEvent } from '../../src/finance/webhooks.js';
import { monthlyReport, refundsTotal } from '../../src/finance/reports.js';
import { customerBalance } from '../../src/finance/ledger.js';
import { reconcilePayout } from '../../src/finance/payouts.js';
import { issuePartialRefund } from '../../src/support/refunds.js';

const at = (iso) => () => new Date(iso);

function october() {
  const store = createPaymentsStore();
  const a = capturePayment(store, { orderId: 'o-50211', customerId: 'c-2207', amountCents: 24900, providerChargeId: 'ch_a' }, at('2026-10-01T09:00:00Z'));
  const b = capturePayment(store, { orderId: 'o-50236', customerId: 'c-1984', amountCents: 18900, providerChargeId: 'ch_b' }, at('2026-10-01T10:00:00Z'));
  const c = capturePayment(store, { orderId: 'o-50298', customerId: 'c-2207', amountCents: 45000, providerChargeId: 'ch_c' }, at('2026-10-01T11:00:00Z'));
  return { store, a, b, c };
}

test('the reported case: support refunds count in the monthly refunds total', () => {
  const { store, a, b, c } = october();
  refundOrder(store, a.id, {}, at('2026-10-02T09:14:52Z'));
  issuePartialRefund(store, { paymentId: b.id, amount: '37.85', agent: 'lena' }, at('2026-10-04T13:02:11Z'));
  issuePartialRefund(store, { paymentId: c.id, amount: '120,00', agent: 'marco' }, at('2026-10-13T10:55:30Z'));
  assert.equal(refundsTotal(store, '2026-10'), 24900 + 3785 + 12000);
  assert.equal(monthlyReport(store, '2026-10').refunds, '€406.85');
  assert.equal(refundsTotal(store, '2026-11'), 0);
});

test('the customer balance includes support refunds', () => {
  const { store, a, c } = october();
  refundOrder(store, a.id, {}, at('2026-10-02T09:00:00Z'));
  issuePartialRefund(store, { paymentId: c.id, amount: '120.00', agent: 'marco' }, at('2026-10-13T10:00:00Z'));
  assert.deepEqual(customerBalance(store, 'c-2207'), { paidCents: 69900, refundedCents: 36900, netCents: 33000 });
});

test('payout reconciliation includes support refunds', () => {
  const { store, b } = october();
  issuePartialRefund(store, { paymentId: b.id, amount: '37.85', agent: 'lena' }, at('2026-10-01T15:00:00Z'));
  const fees = 1520;
  const amountCents = 24900 + 18900 + 45000 - 3785 - fees;
  const result = reconcilePayout(store, { id: 'po_1001', from: '2026-10-01T00:00:00Z', to: '2026-10-02T00:00:00Z', amountCents, feesCents: fees });
  assert.equal(result.expectedCents, amountCents);
  assert.equal(result.differenceCents, 0);
  assert.equal(result.matched, true);
});

test('cancelling an order after a support refund only refunds what is left', () => {
  const { store, b } = october();
  issuePartialRefund(store, { paymentId: b.id, amount: '37.85', agent: 'lena' }, at('2026-10-04T13:00:00Z'));
  assert.equal(refundOrder(store, b.id, {}, at('2026-10-05T09:00:00Z')).amountCents, 18900 - 3785);
  assert.equal(customerBalance(store, 'c-1984').netCents, 0);
  assert.throws(() => refundOrder(store, b.id), /already fully refunded/);
});

test('support cannot refund more than what is left after earlier support refunds', () => {
  const { store, b } = october();
  issuePartialRefund(store, { paymentId: b.id, amount: '100.00', agent: 'lena' }, at('2026-10-04T13:00:00Z'));
  assert.throws(() => issuePartialRefund(store, { paymentId: b.id, amount: '90.00', agent: 'marco' }), /left to refund/);
  issuePartialRefund(store, { paymentId: b.id, amount: '89.00', agent: 'marco' }, at('2026-10-05T13:00:00Z'));
  assert.equal(refundsTotal(store, '2026-10'), 18900);
});

test('checkout and provider refunds are unchanged', () => {
  const { store, a, c } = october();
  refundOrder(store, a.id, {}, at('2026-10-02T09:00:00Z'));
  const event = { id: 'evt_9', type: 'charge.refunded', data: { charge: 'ch_c', refund: { id: 're_9', amount: 12950, created: Date.parse('2026-10-07T16:40:03Z') / 1000 } } };
  assert.deepEqual(handleProviderEvent(store, event), { handled: true });
  assert.deepEqual(handleProviderEvent(store, event), { handled: false });
  assert.equal(refundsTotal(store, '2026-10'), 24900 + 12950);
  assert.equal(refundOrder(store, c.id, {}, at('2026-10-08T09:00:00Z')).amountCents, 45000 - 12950);
});
