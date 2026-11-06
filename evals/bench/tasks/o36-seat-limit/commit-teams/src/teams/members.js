import { assertSeatAvailable } from './seats.js';

/** @typedef {ReturnType<import('./store.js').createTeamStore>} TeamStore */

/** @param {unknown} email */
export function cleanEmail(email) {
  const value = String(email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error('invalid email');
  return value;
}

/**
 * Sign-up: a new workspace with its owner.
 * @param {TeamStore} store
 * @param {{ name: string, seats: number, owner: { email: string, name: string } }} input
 * @param {() => Date} [now]
 */
export function createWorkspace(store, input, now = () => new Date()) {
  const name = String(input.name ?? '').trim();
  if (!name) throw new Error('workspace name is required');
  if (!Number.isInteger(input.seats) || input.seats < 1) throw new Error('seats must be a positive integer');
  const at = now().toISOString();
  const workspace = store.addWorkspace({ id: store.nextId('w'), name, seats: input.seats });
  const owner = store.insertMember({
    id: store.nextId('m'),
    workspaceId: workspace.id,
    email: cleanEmail(input.owner.email),
    name: String(input.owner.name ?? '').trim(),
    role: 'owner',
    status: 'active',
    invitedAt: at,
    joinedAt: at,
    removedAt: null,
  });
  return { workspace, owner };
}

/**
 * Admin UI: invite someone by email. A pending invite takes a seat.
 * @param {TeamStore} store
 * @param {string} workspaceId
 * @param {{ email: string, name?: string, role?: 'admin' | 'member' }} input
 * @param {() => Date} [now]
 */
export function inviteMember(store, workspaceId, input, now = () => new Date()) {
  const email = cleanEmail(input.email);
  if (store.membersOf(workspaceId).some((m) => m.email === email && !m.removedAt)) throw new Error(`${email} is already a member`);
  assertSeatAvailable(store, workspaceId);
  return store.insertMember({
    id: store.nextId('m'),
    workspaceId,
    email,
    name: String(input.name ?? '').trim(),
    role: input.role ?? 'member',
    status: 'invited',
    invitedAt: now().toISOString(),
    joinedAt: null,
    removedAt: null,
  });
}

/** The invitee clicks the link in the email. @param {TeamStore} store @param {string} memberId @param {() => Date} [now] */
export function acceptInvite(store, memberId, now = () => new Date()) {
  const member = store.member(memberId);
  if (!member || member.status !== 'invited') throw new Error('invite not found');
  return store.updateMember(memberId, { status: 'active', joinedAt: now().toISOString() });
}

/** Admin UI: remove a member or revoke a pending invite. @param {TeamStore} store @param {string} memberId @param {() => Date} [now] */
export function removeMember(store, memberId, now = () => new Date()) {
  const member = store.member(memberId);
  if (!member || member.removedAt) throw new Error('member not found');
  if (member.role === 'owner') throw new Error('the workspace owner cannot be removed');
  return store.updateMember(memberId, { status: 'removed', removedAt: now().toISOString() });
}
