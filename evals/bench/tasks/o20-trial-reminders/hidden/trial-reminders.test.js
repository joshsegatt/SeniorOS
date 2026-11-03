import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccountStore } from '../../src/billing/store.js';
import { signUp } from '../../src/billing/accounts.js';
import { canUsePremium, expireTrials, trialsEndingSoon } from '../../src/billing/trials.js';
import { createAccountForCustomer } from '../../src/admin/sales.js';
import { planBanner } from '../../src/web/account-page.js';

const t0 = new Date('2026-10-03T11:40:00Z');
const at = (days, hours = 0) => new Date(t0.getTime() + (days * 24 + hours) * 3_600_000);

function brightline() {
  const store = createAccountStore();
  const account = createAccountForCustomer(store, { company: 'Brightline Ltd', ownerEmail: 'it@brightline.co.uk', salesRep: 'maria' }, () => t0);
  return { store, id: account.id };
}

test('the reported case: an account opened by sales gets the trial reminder', () => {
  const { store, id } = brightline();
  assert.deepEqual(trialsEndingSoon(store, at(10)), []);
  assert.deepEqual(trialsEndingSoon(store, at(11, 1)).map((a) => a.id), [id]);
  assert.deepEqual(trialsEndingSoon(store, at(12)).map((a) => a.id), [id]);
});

test('an account opened by sales loses Pro features when its 14-day trial ends', () => {
  const { store, id } = brightline();
  assert.equal(canUsePremium(store.get(id), at(13, 23)), true);
  assert.equal(canUsePremium(store.get(id), at(14, 1)), false);
});

test('the nightly job moves an account opened by sales to Free after 14 days', () => {
  const { store, id } = brightline();
  assert.deepEqual(expireTrials(store, at(13)), []);
  assert.deepEqual(expireTrials(store, at(14, 1)), [id]);
  assert.equal(store.get(id)?.plan, 'free');
  assert.deepEqual(trialsEndingSoon(store, at(14, 2)), []);
});

test('the account page and the reminder agree on when the trial ends', () => {
  const { store, id } = brightline();
  assert.equal(planBanner(store.get(id), at(12)), 'Pro trial: 2 days left');
});

test('a longer trial set by sales is still respected', () => {
  const store = createAccountStore();
  const a = createAccountForCustomer(store, { company: 'Nordhaus GmbH', ownerEmail: 'it@nordhaus.de', salesRep: 'jonas', trialEndsAt: '2026-11-30T00:00:00.000Z' }, () => t0);
  assert.deepEqual(trialsEndingSoon(store, at(12)), []);
  assert.deepEqual(expireTrials(store, at(20)), []);
  assert.equal(canUsePremium(store.get(a.id), at(20)), true);
  assert.deepEqual(trialsEndingSoon(store, new Date('2026-11-28T00:00:00Z')).map((x) => x.id), [a.id]);
  assert.deepEqual(expireTrials(store, new Date('2026-11-30T00:00:01Z')), [a.id]);
});

test('self-service sign-ups are unchanged', () => {
  const store = createAccountStore();
  const a = signUp(store, { company: 'Acme', email: 'ops@acme.io' }, () => t0);
  assert.deepEqual(trialsEndingSoon(store, at(11, 1)).map((x) => x.id), [a.id]);
  assert.deepEqual(expireTrials(store, at(14)), [a.id]);
});
