import { inside } from '../safe-path.js';
import { UPLOADS, THUMBS } from '../config.js';

export function downloadRoutes({ disk }) {
  return {
    /** GET /files/:name — name may contain folders, sent encoded: /files/albums%2F2026%2Fcover.jpg */
    'GET /files/:name': ({ params }) => ({ status: 200, body: disk.read(inside(UPLOADS, params.name)) }),

    /** GET /thumbs?file=albums/2026/cover.jpg&size=200 */
    'GET /thumbs': ({ query }) => {
      const size = query.get('size') ?? '200';
      return { status: 200, body: disk.read(inside(THUMBS, size, query.get('file') ?? '')) };
    },
  };
}
