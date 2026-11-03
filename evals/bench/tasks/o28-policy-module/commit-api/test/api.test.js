import test from 'node:test';
import assert from 'node:assert/strict';
import { createExportsApi } from '../src/api/exports.js';
import { createReportsApi } from '../src/api/reports.js';
import { createTeamApi } from '../src/api/team.js';
import { createBillingClient } from '../src/billing/client.js';

const plans = { pro: { features: ['exports', 'reports'] }, free: { features: [] } };
const billing = createBillingClient({ fetchPlan: async (orgId) => (orgId === 'acme' ? plans.pro : plans.free) });
const orders = [
  { id: 1, orgId: 'acme', date: '2026-10-02', total: 40 },
  { id: 2, orgId: 'acme', date: '2026-10-20', total: 60 },
  { id: 3, orgId: 'tiny', date: '2026-10-05', total: 15 },
];
const user = (role, orgId = 'acme', extra = {}) => ({ id: `${role}-1`, role, orgId, ...extra });

test('members on a plan with exports can export orders', async () => {
  const api = createExportsApi({ billing, orders });
  const res = await api.exportOrders(user('member'), { from: '2026-10-01', to: '2026-10-31' });
  assert.equal(res.status, 200);
  assert.equal(res.body.csv, 'id,date,total\n1,2026-10-02,40\n2,2026-10-20,60');
  assert.equal((await api.exportOrders(user('member', 'tiny'), { from: '2026-10-01', to: '2026-10-31' })).status, 403);
});

test('reports are for admins and analysts on a plan with reports', async () => {
  const api = createReportsApi({ billing, orders });
  assert.deepEqual(await api.revenueReport(user('analyst')), { status: 200, body: { total: 100 } });
  assert.equal((await api.revenueReport(user('member'))).status, 403);
  assert.equal((await api.revenueReport(user('admin', 'tiny'))).status, 402);
});

test('admins remove members; members can leave', async () => {
  const members = new Map([['m1', { orgId: 'acme' }], ['m2', { orgId: 'acme' }]]);
  const api = createTeamApi({ members });
  assert.equal((await api.removeMember(user('member'), 'm2')).status, 403);
  assert.equal((await api.removeMember({ id: 'm1', role: 'member', orgId: 'acme' }, 'm1')).status, 204);
  assert.equal((await api.removeMember(user('admin'), 'm2')).status, 204);
});

test('suspended users are refused', async () => {
  const api = createReportsApi({ billing, orders });
  assert.deepEqual(await api.revenueReport(user('admin', 'acme', { suspended: true })), { status: 403, body: { error: 'suspended' } });
});
