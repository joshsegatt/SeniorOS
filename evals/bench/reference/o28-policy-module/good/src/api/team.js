import { can } from '../auth/policy.js';
import { deny, handler } from './http.js';

export function createTeamApi({ members }) {
  return {
    removeMember: handler(async (user, memberId) => {
      const check = await can(user, 'team.remove', { memberId });
      if (!check.allowed) return deny(check.status, check.error);
      const member = members.get(memberId);
      if (!member || member.orgId !== user.orgId) return deny(404, 'not_found');
      members.delete(memberId);
      return { status: 204 };
    }),
  };
}
