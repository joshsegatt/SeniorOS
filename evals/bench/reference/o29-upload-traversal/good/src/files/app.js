import { FileMissing } from './disk.js';
import { BadPath } from './safe-path.js';
import { downloadRoutes } from './routes/downloads.js';
import { uploadRoutes } from './routes/uploads.js';
import { profileRoutes } from './routes/profile.js';

function compile(routes) {
  return Object.entries(routes).map(([key, fn]) => {
    const [method, pattern] = key.split(' ');
    return { method, parts: pattern.split('/').filter(Boolean), fn };
  });
}

function match(route, method, segments) {
  if (route.method !== method || route.parts.length !== segments.length) return null;
  const params = {};
  for (let i = 0; i < segments.length; i++) {
    const part = route.parts[i];
    if (part.startsWith(':')) params[part.slice(1)] = decodeURIComponent(segments[i]);
    else if (part !== segments[i]) return null;
  }
  return params;
}

/** The file service: `handle({ method, url, user, body })` -> `{ status, body }`. */
export function createFilesApp({ disk, users }) {
  const routes = compile({ ...downloadRoutes({ disk }), ...uploadRoutes({ disk }), ...profileRoutes({ disk, users }) });

  return {
    handle({ method, url, user = null, body = null }) {
      const parsed = new URL(url, 'http://files.local');
      const segments = parsed.pathname.split('/').filter(Boolean);
      for (const route of routes) {
        const params = match(route, method, segments);
        if (!params) continue;
        try {
          return route.fn({ params, query: parsed.searchParams, user, body });
        } catch (err) {
          if (err instanceof FileMissing) return { status: 404, body: 'not found' };
          if (err instanceof BadPath) return { status: 400, body: 'bad path' };
          if (err instanceof URIError) return { status: 400, body: 'bad request' };
          throw err;
        }
      }
      return { status: 404, body: 'not found' };
    },
  };
}
