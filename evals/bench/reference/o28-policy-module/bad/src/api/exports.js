import { can } from '../auth/policy.js';
import { deny, handler } from './http.js';

export function createExportsApi({ billing, orders }) {
  return {
    exportOrders: handler(async (user, { from, to }) => {
      const check = await can(user, 'orders.export', { billing });
      if (!check.allowed) return deny(check.status, check.error);
      const rows = orders.filter((o) => o.orgId === user.orgId && o.date >= from && o.date <= to);
      return { status: 200, body: { csv: ['id,date,total', ...rows.map((o) => `${o.id},${o.date},${o.total}`)].join('\n') } };
    }),
  };
}
