import { DAY_MS, TRIAL_DAYS, addDays } from '../billing/plans.js';

/**
 * The banner at the top of the account page.
 * @param {import('../billing/store.js').Account} account
 * @param {Date} now
 */
export function planBanner(account, now) {
  if (account.plan === 'pro') return 'Pro plan';
  if (account.plan === 'free') return 'Free plan. Upgrade to Pro to get your projects back.';
  const end = account.trialEndsAt ? new Date(account.trialEndsAt) : addDays(account.createdAt, TRIAL_DAYS);
  const left = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY_MS));
  return `Pro trial: ${left} ${left === 1 ? 'day' : 'days'} left`;
}
