import { TRIAL_DAYS, addDays } from '../billing/plans.js';

/**
 * Back office: a sales rep opens an account for a customer they signed (from the CRM deal page).
 * Sales can give a longer trial by setting trialEndsAt; otherwise it is the usual 14-day trial.
 * @param {ReturnType<import('../billing/store.js').createAccountStore>} store
 * @param {{ company: string, ownerEmail: string, salesRep: string, trialEndsAt?: string | null }} input
 * @param {() => Date} [now]
 */
export function createAccountForCustomer(store, input, now = () => new Date()) {
  const company = String(input.company ?? '').trim();
  const ownerEmail = String(input.ownerEmail ?? '').trim().toLowerCase();
  if (!company || !ownerEmail) throw new Error('company and owner email are required');
  if (!input.salesRep) throw new Error('salesRep is required');
  if (input.trialEndsAt != null && Number.isNaN(Date.parse(input.trialEndsAt))) throw new Error('invalid trialEndsAt');
  const at = now();
  return store.insert({
    id: store.nextId(),
    company,
    ownerEmail,
    plan: 'trial',
    trialEndsAt: input.trialEndsAt ?? addDays(at, TRIAL_DAYS).toISOString(),
    createdAt: at.toISOString(),
    salesRep: input.salesRep,
  });
}
