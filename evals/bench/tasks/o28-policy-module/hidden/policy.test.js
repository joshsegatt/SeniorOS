import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createExportsApi } from '../../src/api/exports.js';
import { createReportsApi } from '../../src/api/reports.js';
import { createTeamApi } from '../../src/api/team.js';
import { createBillingClient } from '../../src/billing/client.js';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const orders = [
  { id: 1, orgId: 'acme', date: '2026-10-02', total: 40 },
  { id: 2, orgId: 'acme', date: '2026-10-20', total: 60 },
];
const range = { from: '2026-10-01', to: '2026-10-31' };
const user = (role, extra = {}) => ({ id: `${role}-1`, role, orgId: 'acme', ...extra });

/** The billing service as the handlers see it, with a call counter and an outage switch. */
function fakeBilling(features = ['exports', 'reports']) {
  const state = { calls: 0, down: false };
  const client = createBillingClient({
    fetchPlan: async () => {
      state.calls += 1;
      if (state.down) throw new Error('connect ECONNREFUSED billing:443');
      return { features };
    },
  });
  return { client, state };
}

test('the checks live in src/auth/policy.js and the handlers use it', async () => {
  assert.ok(existsSync(new URL('../../src/auth/policy.js', import.meta.url)), 'src/auth/policy.js exists');
  const policy = await import('../../src/auth/policy.js');
  assert.equal(typeof policy.can, 'function', 'policy exports can');
  for (const file of ['src/api/exports.js', 'src/api/reports.js', 'src/api/team.js']) {
    const text = src(file);
    assert.match(text, /from\s+['"]\.\.\/auth\/policy\.js['"]/, `${file} uses the policy module`);
    assert.doesNotMatch(text, /\.suspended|hasFeature\(|\.role\s*[!=]==/, `${file} no longer inlines its checks`);
  }
});

test('admins export without asking billing, even during a billing outage', async () => {
  const { client, state } = fakeBilling([]);
  state.down = true;
  const api = createExportsApi({ billing: client, orders });
  const res = await api.exportOrders(user('admin'), range);
  assert.equal(res.status, 200);
  assert.equal(res.body.csv, 'id,date,total\n1,2026-10-02,40\n2,2026-10-20,60');
  assert.equal(state.calls, 0);
});

test('members need the exports feature; billing is asked once', async () => {
  const on = fakeBilling(['exports']);
  assert.equal((await createExportsApi({ billing: on.client, orders }).exportOrders(user('member'), range)).status, 200);
  assert.equal(on.state.calls, 1);
  const off = fakeBilling([]);
  assert.deepEqual(await createExportsApi({ billing: off.client, orders }).exportOrders(user('member'), range), { status: 403, body: { error: 'forbidden' } });
  const down = fakeBilling();
  down.state.down = true;
  assert.deepEqual(await createExportsApi({ billing: down.client, orders }).exportOrders(user('member'), range), { status: 503, body: { error: 'billing_unavailable' } });
});

test('suspended users are refused before anything else', async () => {
  const { client, state } = fakeBilling();
  state.down = true;
  const susp = user('admin', { suspended: true });
  assert.deepEqual(await createExportsApi({ billing: client, orders }).exportOrders(user('member', { suspended: true }), range), { status: 403, body: { error: 'suspended' } });
  assert.deepEqual(await createReportsApi({ billing: client, orders }).revenueReport(susp), { status: 403, body: { error: 'suspended' } });
  assert.deepEqual(await createTeamApi({ members: new Map() }).removeMember(susp, 'm1'), { status: 403, body: { error: 'suspended' } });
  assert.equal(state.calls, 0);
});

test('reports: role first, then the plan, which even admins need', async () => {
  const { client, state } = fakeBilling([]);
  const api = createReportsApi({ billing: client, orders });
  state.down = true;
  assert.deepEqual(await api.revenueReport(user('member')), { status: 403, body: { error: 'forbidden' } });
  assert.equal(state.calls, 0);
  assert.equal((await api.revenueReport(user('admin'))).status, 503);
  state.down = false;
  assert.deepEqual(await api.revenueReport(user('admin')), { status: 402, body: { error: 'upgrade_required' } });
  const pro = fakeBilling(['reports']);
  assert.deepEqual(await createReportsApi({ billing: pro.client, orders }).revenueReport(user('analyst')), { status: 200, body: { total: 100 } });
  assert.equal(pro.state.calls, 1);
});

test('team: admins remove anyone, members only themselves', async () => {
  const members = new Map([['m1', { orgId: 'acme' }], ['m2', { orgId: 'acme' }], ['x1', { orgId: 'other' }]]);
  const api = createTeamApi({ members });
  assert.deepEqual(await api.removeMember({ id: 'm1', role: 'member', orgId: 'acme' }, 'm2'), { status: 403, body: { error: 'forbidden' } });
  assert.deepEqual(await api.removeMember({ id: 'm1', role: 'member', orgId: 'acme' }, 'm1'), { status: 204 });
  assert.deepEqual(await api.removeMember(user('admin'), 'x1'), { status: 404, body: { error: 'not_found' } });
  assert.deepEqual(await api.removeMember(user('analyst'), 'm2'), { status: 403, body: { error: 'forbidden' } });
  assert.deepEqual(await api.removeMember(user('admin'), 'm2'), { status: 204 });
});
