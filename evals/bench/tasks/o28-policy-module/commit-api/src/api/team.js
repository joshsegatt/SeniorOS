import { deny, handler } from './http.js';

export function createTeamApi({ members }) {
  return {
    removeMember: handler(async (user, memberId) => {
      if (user.suspended) return deny(403, 'suspended');
      if (user.role !== 'admin' && user.id !== memberId) return deny(403, 'forbidden');
      const member = members.get(memberId);
      if (!member || member.orgId !== user.orgId) return deny(404, 'not_found');
      members.delete(memberId);
      return { status: 204 };
    }),
  };
}
