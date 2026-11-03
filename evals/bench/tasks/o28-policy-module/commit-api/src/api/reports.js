import { deny, handler } from './http.js';

export function createReportsApi({ billing, orders }) {
  return {
    revenueReport: handler(async (user) => {
      if (user.suspended) return deny(403, 'suspended');
      if (user.role !== 'admin' && user.role !== 'analyst') return deny(403, 'forbidden');
      if (!(await billing.hasFeature(user.orgId, 'reports'))) return deny(402, 'upgrade_required');
      const total = orders.filter((o) => o.orgId === user.orgId).reduce((sum, o) => sum + o.total, 0);
      return { status: 200, body: { total } };
    }),
  };
}
