import { TRIAL_DAYS, addDays } from './plans.js';

/**
 * Self-service sign-up from the website.
 * @param {ReturnType<import('./store.js').createAccountStore>} store
 * @param {{ company: string, email: string }} input
 * @param {() => Date} [now]
 */
export function signUp(store, input, now = () => new Date()) {
  const company = String(input.company ?? '').trim();
  const ownerEmail = String(input.email ?? '').trim().toLowerCase();
  if (!company) throw new Error('company is required');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) throw new Error('invalid email');
  const at = now();
  return store.insert({ id: store.nextId(), company, ownerEmail, plan: 'trial', trialEndsAt: addDays(at, TRIAL_DAYS).toISOString(), createdAt: at.toISOString() });
}

/** The customer enters a card and upgrades. @param {ReturnType<import('./store.js').createAccountStore>} store @param {string} id */
export function upgradeToPro(store, id) {
  return store.update(id, { plan: 'pro', trialEndsAt: null });
}
