import test from 'node:test';
import assert from 'node:assert/strict';
import { createTeamStore } from '../../src/teams/store.js';
import { createWorkspace, inviteMember, removeMember } from '../../src/teams/members.js';
import { scimCreateUser, scimPatchUser } from '../../src/teams/scim.js';
import { seatsUsed } from '../../src/teams/seats.js';
import { billableSeats } from '../../src/teams/billing.js';
import { listMembers } from '../../src/teams/api.js';
import { membersPage } from '../../src/web/members-page.js';

const t0 = new Date('2026-07-14T08:00:00Z');
const on = (iso) => () => new Date(iso);
const people = ['tom', 'priya', 'sam', 'julia', 'marco', 'nina', 'chris', 'yuki', 'omar'];

/** Acme: 10 seats, the owner plus nine users provisioned from Okta, three of them later unassigned. */
function acme() {
  const store = createTeamStore();
  const { workspace } = createWorkspace(store, { name: 'Acme', seats: 10, owner: { email: 'dana.whitfield@acme.io', name: 'Dana Whitfield' } }, () => t0);
  const ws = workspace.id;
  for (const p of people) scimCreateUser(store, ws, { externalId: `okta-${p}`, userName: `${p}@acme.io`, displayName: p }, () => t0);
  for (const p of ['sam', 'marco', 'omar']) scimPatchUser(store, ws, `okta-${p}`, { active: false }, on('2026-10-20T10:00:00Z'));
  return { store, ws };
}

test('the reported case: users unassigned in the identity provider free their seat', () => {
  const { store, ws } = acme();
  assert.equal(membersPage(store, ws).heading, 'Acme: 7 members');
  assert.equal(seatsUsed(store, ws), 7);
  assert.equal(inviteMember(store, ws, { email: 'lea@acme.io' }, on('2026-11-05T09:00:00Z')).status, 'invited');
  assert.equal(seatsUsed(store, ws), 8);
});

test('the identity provider can provision new users into the freed seats', () => {
  const { store, ws } = acme();
  for (const p of ['ana', 'ben', 'cleo']) scimCreateUser(store, ws, { externalId: `okta-${p}`, userName: `${p}@acme.io` }, on('2026-11-05T09:00:00Z'));
  assert.equal(seatsUsed(store, ws), 10);
  assert.throws(() => scimCreateUser(store, ws, { externalId: 'okta-dev', userName: 'dev@acme.io' }), /seat limit reached/);
});

test('deprovisioned users are billed for the month they left, not after', () => {
  const { store, ws } = acme();
  assert.equal(billableSeats(store, ws, '2026-10'), 10);
  assert.equal(billableSeats(store, ws, '2026-11'), 7);
  assert.equal(billableSeats(store, ws, '2026-12'), 7);
});

test('the members API no longer lists deprovisioned users', () => {
  const { store, ws } = acme();
  const emails = listMembers(store, ws).map((m) => m.email);
  assert.equal(emails.length, 7);
  for (const p of ['sam', 'marco', 'omar']) assert.ok(!emails.includes(`${p}@acme.io`), `${p} still listed`);
});

test('a deprovisioned user can be invited back by email', () => {
  const { store, ws } = acme();
  const sam = inviteMember(store, ws, { email: 'sam@acme.io' }, on('2026-11-05T09:00:00Z'));
  assert.equal(sam.status, 'invited');
  assert.equal(membersPage(store, ws).pendingInvites.includes('sam@acme.io'), true);
});

test('a user assigned again in the identity provider takes a seat again', () => {
  const { store, ws } = acme();
  scimPatchUser(store, ws, 'okta-marco', { active: true }, on('2026-11-02T10:00:00Z'));
  assert.equal(seatsUsed(store, ws), 8);
  assert.ok(listMembers(store, ws).some((m) => m.email === 'marco@acme.io'));
  assert.equal(membersPage(store, ws).heading, 'Acme: 8 members');
  assert.equal(billableSeats(store, ws, '2026-12'), 8);
});

test('members removed in the admin UI are unchanged', () => {
  const { store, ws } = acme();
  const tom = store.membersOf(ws).find((m) => m.email === 'tom@acme.io');
  removeMember(store, tom.id, on('2026-11-03T12:00:00Z'));
  assert.equal(seatsUsed(store, ws), 6);
  assert.equal(billableSeats(store, ws, '2026-11'), 7);
  assert.equal(billableSeats(store, ws, '2026-12'), 6);
  assert.equal(membersPage(store, ws).heading, 'Acme: 6 members');
});
