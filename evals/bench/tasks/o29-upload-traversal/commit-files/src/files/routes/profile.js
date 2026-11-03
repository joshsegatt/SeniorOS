import { posix } from 'node:path';
import { UPLOADS } from '../config.js';

export function profileRoutes({ disk, users }) {
  return {
    /** PUT /me/avatar { file: 'avatars/ana.png' } — one of the user's uploads becomes their avatar */
    'PUT /me/avatar': ({ user, body }) => {
      if (!user) return { status: 401, body: 'sign in first' };
      if (!body?.file) return { status: 400, body: 'file is required' };
      users.get(user.id).avatar = body.file;
      return { status: 204 };
    },

    'GET /users/:id/avatar': ({ params }) => {
      const profile = users.get(params.id);
      if (!profile?.avatar) return { status: 404, body: 'no avatar' };
      return { status: 200, body: disk.read(posix.join(UPLOADS, profile.avatar)) };
    },
  };
}
