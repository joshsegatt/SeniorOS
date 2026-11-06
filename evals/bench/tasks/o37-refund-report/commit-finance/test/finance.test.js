import test from 'node:test';
import assert from 'node:assert/strict';
import { createPaymentsStore } from '../src/finance/store.js';
import { capturePayment, refundOrder } from '../src/finance/checkout.js';
import { handleProviderEvent } from '../src/finance/webhooks.js';
import { monthlyReport, refundsTotal } from '../src/finance/reports.js';
import { customerBalance } from '../src/finance/ledger.js';
import { reconcilePayout } from '../src/finance/payouts.js';
import { issuePartialRefund } from '../src/support/refunds.js';
import { formatEuros, toCents } from '../src/finance/money.js';

const at = (iso) => () => new Date(iso);

function shop() {
  const store = createPaymentsStore();
  const a = capturePayment(store, { orderId: 'o-1', customerId: 'c-1', amountCents: 24900, providerChargeId: 'ch_1' }, at('2026-10-01T09:00:00Z'));
  const b = capturePayment(store, { orderId: 'o-2', customerId: 'c-2', amountCents: 12950, providerChargeId: 'ch_2' }, at('2026-10-01T10:00:00Z'));
  return { store, a, b };
}

test('money helpers', () => {
  assert.equal(toCents('37.85'), 3785);
  assert.equal(toCents(129.5), 12950);
  assert.equal(formatEuros(124000), '€1,240.00');
  assert.equal(formatEuros(-3785), '-€37.85');
});

test('a cancelled order is refunded in full and shows in the report', () => {
  const { store, a } = shop();
  const refund = refundOrder(store, a.id, {}, at('2026-10-02T12:00:00Z'));
  assert.equal(refund.amountCents, 24900);
  assert.equal(refundsTotal(store, '2026-10'), 24900);
  assert.equal(refundsTotal(store, '2026-09'), 0);
  assert.deepEqual(monthlyReport(store, '2026-10'), { month: '2026-10', charges: '€378.50', refunds: '€249.00', net: '€129.50' });
  assert.throws(() => refundOrder(store, a.id), /already fully refunded/);
});

test('provider refunds are recorded once', () => {
  const { store, b } = shop();
  const event = { id: 'evt_1', type: 'charge.refunded', data: { charge: 'ch_2', refund: { id: 're_1', amount: 5000, created: Date.parse('2026-10-03T08:00:00Z') / 1000 } } };
  assert.deepEqual(handleProviderEvent(store, event), { handled: true });
  assert.deepEqual(handleProviderEvent(store, event), { handled: false });
  assert.equal(refundsTotal(store, '2026-10'), 5000);
  assert.equal(customerBalance(store, 'c-2').netCents, 7950);
  assert.equal(refundOrder(store, b.id).amountCents, 7950);
});

test('payouts reconcile against charges, refunds and fees', () => {
  const { store, a } = shop();
  refundOrder(store, a.id, {}, at('2026-10-01T18:00:00Z'));
  const payout = { id: 'po_1', from: '2026-10-01T00:00:00Z', to: '2026-10-02T00:00:00Z', amountCents: 12950 - 410, feesCents: 410 };
  assert.deepEqual(reconcilePayout(store, payout), { payoutId: 'po_1', expectedCents: 12540, differenceCents: 0, matched: true });
});

test('support can refund part of a payment', () => {
  const { store, a } = shop();
  const refund = issuePartialRefund(store, { paymentId: a.id, amount: '37,85', agent: 'lena', note: 'lid cracked' }, at('2026-10-04T13:00:00Z'));
  assert.equal(refund.source, 'support');
  assert.equal(refund.customerId, 'c-1');
  assert.throws(() => issuePartialRefund(store, { paymentId: a.id, amount: 'ten', agent: 'lena' }), /invalid amount/);
  assert.throws(() => issuePartialRefund(store, { paymentId: a.id, amount: '0', agent: 'lena' }), /invalid amount/);
  assert.throws(() => issuePartialRefund(store, { paymentId: a.id, amount: '300.00', agent: 'lena' }), /left to refund/);
  assert.throws(() => issuePartialRefund(store, { paymentId: a.id, amount: '5.00' }), /agent/);
});
