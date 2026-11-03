import { DAY_MS } from './plans.js';

/** @typedef {import('./store.js').Account} Account */

/**
 * Accounts whose trial ends within the next `days` days; the daily job sends them the
 * "your trial ends in N days" email.
 * @param {ReturnType<import('./store.js').createAccountStore>} store
 * @param {Date} now
 * @param {number} [days]
 */
export function trialsEndingSoon(store, now, days = 3) {
  const until = now.getTime() + days * DAY_MS;
  return store.all().filter((a) => {
    if (a.plan !== 'trial' || !a.trialEndsAt) return false;
    const end = Date.parse(a.trialEndsAt);
    return end > now.getTime() && end <= until;
  });
}

/** Whether the account can use Pro features right now. @param {Account} account @param {Date} now */
export function canUsePremium(account, now) {
  if (account.plan === 'pro') return true;
  if (account.plan !== 'trial') return false;
  return !account.trialEndsAt || now.getTime() < Date.parse(account.trialEndsAt);
}

/**
 * Nightly job: trials that have ended move to the free plan.
 * @param {ReturnType<import('./store.js').createAccountStore>} store
 * @param {Date} now
 * @returns {string[]} ids of the accounts moved to free
 */
export function expireTrials(store, now) {
  const expired = store.all().filter((a) => a.plan === 'trial' && a.trialEndsAt && Date.parse(a.trialEndsAt) <= now.getTime());
  for (const a of expired) store.update(a.id, { plan: 'free' });
  return expired.map((a) => a.id);
}
