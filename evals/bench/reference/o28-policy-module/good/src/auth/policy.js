const ok = { allowed: true };
const no = (status, error) => ({ allowed: false, status, error });
const isAdmin = (user) => user.role === 'admin';

/**
 * Can `user` do `action`? Checks run in order and stop at the first that decides, so billing is only asked
 * when the answer depends on the plan.
 * @returns {Promise<{ allowed: true } | { allowed: false, status: number, error: string }>}
 */
export async function can(user, action, { billing, memberId } = {}) {
  if (user.suspended) return no(403, 'suspended');
  switch (action) {
    case 'orders.export':
      return isAdmin(user) || (await billing.hasFeature(user.orgId, 'exports')) ? ok : no(403, 'forbidden');
    case 'reports.view':
      if (!isAdmin(user) && user.role !== 'analyst') return no(403, 'forbidden');
      return (await billing.hasFeature(user.orgId, 'reports')) ? ok : no(402, 'upgrade_required');
    case 'team.remove':
      return isAdmin(user) || user.id === memberId ? ok : no(403, 'forbidden');
    default:
      throw new Error(`unknown action ${action}`);
  }
}
