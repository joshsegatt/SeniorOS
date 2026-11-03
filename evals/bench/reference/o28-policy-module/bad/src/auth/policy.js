const isAdmin = ({ user }) => user.role === 'admin';
const isAnalyst = ({ user }) => user.role === 'analyst';
const isSelf = ({ user, memberId }) => user.id === memberId;
const hasFeature = (feature) => ({ user, billing }) => billing.hasFeature(user.orgId, feature);
const anyOf = (...checks) => async (ctx) => (await Promise.all(checks.map((check) => check(ctx)))).some(Boolean);

/** Each action: rules checked in order, each with the response when it fails. */
const RULES = {
  'orders.export': [[anyOf(isAdmin, hasFeature('exports')), 403, 'forbidden']],
  'reports.view': [
    [anyOf(isAdmin, isAnalyst), 403, 'forbidden'],
    [hasFeature('reports'), 402, 'upgrade_required'],
  ],
  'team.remove': [[anyOf(isAdmin, isSelf), 403, 'forbidden']],
};

/** @returns {Promise<{ allowed: true } | { allowed: false, status: number, error: string }>} */
export async function can(user, action, { billing, memberId } = {}) {
  if (user.suspended) return { allowed: false, status: 403, error: 'suspended' };
  const rules = RULES[action];
  if (!rules) throw new Error(`unknown action ${action}`);
  for (const [check, status, error] of rules) {
    if (!(await check({ user, billing, memberId }))) return { allowed: false, status, error };
  }
  return { allowed: true };
}
