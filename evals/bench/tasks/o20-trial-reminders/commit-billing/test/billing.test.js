import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccountStore } from '../src/billing/store.js';
import { signUp, upgradeToPro } from '../src/billing/accounts.js';
import { canUsePremium, expireTrials, trialsEndingSoon } from '../src/billing/trials.js';
import { createAccountForCustomer } from '../src/admin/sales.js';
import { planBanner } from '../src/web/account-page.js';

const t0 = new Date('2026-10-01T10:00:00Z');
const at = (days, hours = 0) => new Date(t0.getTime() + (days * 24 + hours) * 3_600_000);

test('sign-up starts a 14-day trial', () => {
  const store = createAccountStore();
  const a = signUp(store, { company: 'Acme', email: 'Ops@Acme.io' }, () => t0);
  assert.equal(a.plan, 'trial');
  assert.equal(a.trialEndsAt, '2026-10-15T10:00:00.000Z');
  assert.equal(planBanner(a, at(1)), 'Pro trial: 13 days left');
});

test('the reminder goes out in the last three days of the trial', () => {
  const store = createAccountStore();
  const a = signUp(store, { company: 'Acme', email: 'ops@acme.io' }, () => t0);
  assert.deepEqual(trialsEndingSoon(store, at(10)), []);
  assert.deepEqual(trialsEndingSoon(store, at(11, 1)).map((x) => x.id), [a.id]);
  assert.deepEqual(trialsEndingSoon(store, at(14, 1)), []);
});

test('trials end and move to the free plan', () => {
  const store = createAccountStore();
  const a = signUp(store, { company: 'Acme', email: 'ops@acme.io' }, () => t0);
  assert.equal(canUsePremium(store.get(a.id), at(13)), true);
  assert.deepEqual(expireTrials(store, at(13)), []);
  assert.deepEqual(expireTrials(store, at(14)), [a.id]);
  assert.equal(canUsePremium(store.get(a.id), at(14)), false);
  assert.equal(planBanner(store.get(a.id), at(15)), 'Free plan. Upgrade to Pro to get your projects back.');
});

test('pro accounts are never reminded or expired', () => {
  const store = createAccountStore();
  const a = signUp(store, { company: 'Acme', email: 'ops@acme.io' }, () => t0);
  upgradeToPro(store, a.id);
  assert.deepEqual(trialsEndingSoon(store, at(12)), []);
  assert.deepEqual(expireTrials(store, at(30)), []);
  assert.equal(canUsePremium(store.get(a.id), at(30)), true);
});

test('sales can open an account with a longer trial', () => {
  const store = createAccountStore();
  const a = createAccountForCustomer(store, { company: 'Nordhaus GmbH', ownerEmail: 'it@nordhaus.de', salesRep: 'jonas', trialEndsAt: '2026-11-30T00:00:00.000Z' }, () => t0);
  assert.equal(a.salesRep, 'jonas');
  assert.deepEqual(trialsEndingSoon(store, at(12)), []);
  assert.deepEqual(trialsEndingSoon(store, new Date('2026-11-28T00:00:00Z')).map((x) => x.id), [a.id]);
  assert.throws(() => createAccountForCustomer(store, { company: 'X', ownerEmail: 'x@x.io', salesRep: 'jonas', trialEndsAt: 'soon' }), /trialEndsAt/);
});
