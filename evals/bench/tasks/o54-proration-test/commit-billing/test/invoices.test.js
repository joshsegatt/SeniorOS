import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInvoice, invoiceText } from '../src/billing/invoices.js';
import { formatCents } from '../src/billing/money.js';
import { handleChangePlan } from '../src/api/change-plan.js';
import { lumen } from '../src/billing/__tests__/fixtures.js';

test('amounts print as dollars', () => {
  assert.equal(formatCents(3709), '$37.09');
  assert.equal(formatCents(-1291), '-$12.91');
  assert.equal(formatCents(5), '$0.05');
  assert.throws(() => formatCents(1.5), /whole number/);
});

test('an invoice adds up its lines', () => {
  const invoice = buildInvoice('Lumen Studio', [{ description: 'a', amountCents: 1403 }, { description: 'b', amountCents: -435 }], '2026-03-17');
  assert.equal(invoice.totalCents, 968);
  assert.match(invoiceText(invoice), /Total\s+\$9\.68$/);
});

test('the plan change endpoint returns the prorated invoice', () => {
  const subs = new Map([['sub-207', lumen()]]);
  const res = handleChangePlan({ params: { id: 'sub-207' }, body: { plan: 'business' } }, subs, () => new Date('2026-03-17T10:00:00Z'));
  assert.equal(res.status, 200);
  assert.equal(res.body.subscription.planId, 'business');
  assert.equal(res.body.invoice.totalCents, 3388);
  assert.equal(subs.get('sub-207').planId, 'business');
});

test('the plan change endpoint rejects bad requests', () => {
  const subs = new Map([['sub-207', lumen()]]);
  assert.equal(handleChangePlan({ params: { id: 'nope' }, body: { plan: 'team' } }, subs).status, 404);
  assert.equal(handleChangePlan({ params: { id: 'sub-207' }, body: {} }, subs).status, 400);
  assert.equal(handleChangePlan({ params: { id: 'sub-207' }, body: { plan: 'team', effective: '2026-05-01' } }, subs).status, 422);
});
