import { can } from '../auth/policy.js';
import { deny, handler } from './http.js';

export function createReportsApi({ billing, orders }) {
  return {
    revenueReport: handler(async (user) => {
      const check = await can(user, 'reports.view', { billing });
      if (!check.allowed) return deny(check.status, check.error);
      const total = orders.filter((o) => o.orgId === user.orgId).reduce((sum, o) => sum + o.total, 0);
      return { status: 200, body: { total } };
    }),
  };
}
