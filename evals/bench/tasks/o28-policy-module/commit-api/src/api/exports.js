import { deny, handler } from './http.js';

export function createExportsApi({ billing, orders }) {
  return {
    exportOrders: handler(async (user, { from, to }) => {
      if (user.suspended) return deny(403, 'suspended');
      if (!(user.role === 'admin' || (await billing.hasFeature(user.orgId, 'exports')))) return deny(403, 'forbidden');
      const rows = orders.filter((o) => o.orgId === user.orgId && o.date >= from && o.date <= to);
      return { status: 200, body: { csv: ['id,date,total', ...rows.map((o) => `${o.id},${o.date},${o.total}`)].join('\n') } };
    }),
  };
}
