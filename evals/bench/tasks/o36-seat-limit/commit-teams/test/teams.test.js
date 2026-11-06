import test from 'node:test';
import assert from 'node:assert/strict';
import { createTeamStore } from '../src/teams/store.js';
import { acceptInvite, createWorkspace, inviteMember, removeMember } from '../src/teams/members.js';
import { scimCreateUser, scimPatchUser } from '../src/teams/scim.js';
import { seatsLeft, seatsUsed } from '../src/teams/seats.js';
import { billableSeats, seatInvoiceLine } from '../src/teams/billing.js';
import { listMembers } from '../src/teams/api.js';
import { membersPage } from '../src/web/members-page.js';

const t0 = new Date('2026-10-01T09:00:00Z');
const at = (days) => () => new Date(t0.getTime() + days * 86_400_000);

function team(seats = 3) {
  const store = createTeamStore();
  const { workspace, owner } = createWorkspace(store, { name: 'Northwind', seats, owner: { email: 'Ada@Northwind.io', name: 'Ada' } }, () => t0);
  return { store, ws: workspace.id, owner };
}

test('a new workspace has its owner on the first seat', () => {
  const { store, ws, owner } = team();
  assert.equal(owner.email, 'ada@northwind.io');
  assert.equal(seatsUsed(store, ws), 1);
  assert.equal(membersPage(store, ws).heading, 'Northwind: 1 member');
});

test('pending invites take a seat until the limit', () => {
  const { store, ws } = team(3);
  const bo = inviteMember(store, ws, { email: 'bo@northwind.io', name: 'Bo' }, at(1));
  inviteMember(store, ws, { email: 'cy@northwind.io' }, at(1));
  assert.equal(seatsLeft(store, ws), 0);
  assert.throws(() => inviteMember(store, ws, { email: 'di@northwind.io' }), /seat limit reached/);
  assert.throws(() => inviteMember(store, ws, { email: 'BO@northwind.io' }), /already a member/);
  acceptInvite(store, bo.id, at(2));
  assert.deepEqual(membersPage(store, ws), {
    heading: 'Northwind: 2 members',
    members: [{ name: 'Ada', email: 'ada@northwind.io', role: 'owner' }, { name: 'Bo', email: 'bo@northwind.io', role: 'member' }],
    pendingInvites: ['cy@northwind.io'],
  });
});

test('removing a member frees the seat and they can be invited again', () => {
  const { store, ws, owner } = team(2);
  const bo = acceptInvite(store, inviteMember(store, ws, { email: 'bo@northwind.io' }, at(1)).id, at(1));
  assert.throws(() => inviteMember(store, ws, { email: 'cy@northwind.io' }), /seat limit reached/);
  removeMember(store, bo.id, at(5));
  assert.equal(seatsUsed(store, ws), 1);
  assert.equal(inviteMember(store, ws, { email: 'bo@northwind.io' }, at(6)).status, 'invited');
  assert.throws(() => removeMember(store, owner.id), /owner/);
});

test('members are billed for every month they held a seat', () => {
  const { store, ws } = team(5);
  const bo = acceptInvite(store, inviteMember(store, ws, { email: 'bo@northwind.io' }, at(1)).id, at(2));
  inviteMember(store, ws, { email: 'cy@northwind.io' }, at(3));
  assert.equal(billableSeats(store, ws, '2026-10'), 2);
  removeMember(store, bo.id, at(40));
  assert.equal(billableSeats(store, ws, '2026-11'), 2);
  assert.equal(billableSeats(store, ws, '2026-12'), 1);
  assert.deepEqual(seatInvoiceLine(store, ws, '2026-12', 12.5), { description: 'Seats (2026-12)', quantity: 1, unitPrice: 12.5, total: 12.5 });
});

test('the identity provider provisions and deprovisions users', () => {
  const { store, ws } = team(5);
  const tom = scimCreateUser(store, ws, { externalId: '00u1', userName: 'Tom@northwind.io', displayName: 'Tom' }, at(1));
  assert.equal(tom.status, 'active');
  assert.equal(scimCreateUser(store, ws, { externalId: '00u1', userName: 'tom@northwind.io' }, at(1)).id, tom.id);
  assert.deepEqual(listMembers(store, ws).map((m) => m.email), ['ada@northwind.io', 'tom@northwind.io']);
  scimPatchUser(store, ws, '00u1', { active: false }, at(3));
  assert.equal(membersPage(store, ws).heading, 'Northwind: 1 member');
  scimPatchUser(store, ws, '00u1', { active: true }, at(4));
  assert.equal(membersPage(store, ws).heading, 'Northwind: 2 members');
  assert.throws(() => scimPatchUser(store, ws, '00u9', { active: false }), /unknown SCIM user/);
});

test('the members API lists members and pending invites', () => {
  const { store, ws } = team(5);
  inviteMember(store, ws, { email: 'bo@northwind.io', name: 'Bo', role: 'admin' }, at(1));
  assert.deepEqual(listMembers(store, ws)[1], { id: 'm-83', email: 'bo@northwind.io', name: 'Bo', role: 'admin', pending: true });
});
