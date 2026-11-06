import { cleanEmail } from './members.js';
import { assertSeatAvailable } from './seats.js';

/** @typedef {ReturnType<import('./store.js').createTeamStore>} TeamStore */

/** @param {TeamStore} store @param {string} workspaceId @param {string} externalId */
function findByExternalId(store, workspaceId, externalId) {
  return store.membersOf(workspaceId).findLast((m) => m.scimId === externalId) ?? null;
}

/**
 * SCIM `POST /Users` from the identity provider: the user is assigned to our app.
 * Users provisioned this way skip the invite email and are active right away.
 * @param {TeamStore} store
 * @param {string} workspaceId
 * @param {{ externalId: string, userName: string, displayName?: string }} user
 * @param {() => Date} [now]
 */
export function scimCreateUser(store, workspaceId, user, now = () => new Date()) {
  const email = cleanEmail(user.userName);
  const existing = store.membersOf(workspaceId).find((m) => m.email === email && !m.removedAt);
  if (existing) return store.updateMember(existing.id, { scimId: user.externalId });
  assertSeatAvailable(store, workspaceId);
  const at = now().toISOString();
  return store.insertMember({
    id: store.nextId('m'),
    workspaceId,
    email,
    name: String(user.displayName ?? '').trim(),
    role: 'member',
    status: 'active',
    scimId: user.externalId,
    invitedAt: at,
    joinedAt: at,
    removedAt: null,
  });
}

/**
 * SCIM `PATCH /Users/:id` with `active`: the user was unassigned from our app (or suspended) in the
 * identity provider, or assigned again.
 * @param {TeamStore} store
 * @param {string} workspaceId
 * @param {string} externalId
 * @param {{ active: boolean }} patch
 * @param {() => Date} [now]
 */
export function scimPatchUser(store, workspaceId, externalId, patch, now = () => new Date()) {
  const member = findByExternalId(store, workspaceId, externalId);
  if (!member) throw new Error(`unknown SCIM user ${externalId}`);
  if (patch.active === false && member.status === 'active') {
    return store.updateMember(member.id, { status: 'deprovisioned' });
  }
  if (patch.active === true && member.status === 'deprovisioned') {
    assertSeatAvailable(store, workspaceId);
    return store.updateMember(member.id, { status: 'active' });
  }
  return member;
}
