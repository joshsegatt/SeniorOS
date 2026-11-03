import { inside } from '../safe-path.js';
import { UPLOADS } from '../config.js';

export function uploadRoutes({ disk }) {
  return {
    /** POST /uploads { name: 'albums/2026/cover.jpg', content } */
    'POST /uploads': ({ user, body }) => {
      if (!user) return { status: 401, body: 'sign in first' };
      if (!body?.name || typeof body.content !== 'string') return { status: 400, body: 'name and content are required' };
      disk.write(inside(UPLOADS, body.name), body.content);
      return { status: 201, body: { name: body.name, url: `/files/${encodeURIComponent(body.name)}` } };
    },
  };
}
