/** Path segments the way browsers and our old PHP routes treated them: case-insensitive, `.`/`..` and `//` resolved. */
function segmentsOf(path) {
  const out = [];
  for (const raw of path.split('/')) {
    const seg = decodeURIComponent(raw).toLowerCase();
    if (seg === '' || seg === '.') continue;
    if (seg === '..') out.pop();
    else out.push(seg);
  }
  return out;
}

export function createRouter() {
  const routes = [];
  return {
    add(method, pattern, handler) {
      routes.push({ method, parts: segmentsOf(pattern), handler });
    },
    /** @returns {{ handler: Function, params: Record<string, string> } | null} */
    match(method, path) {
      const segs = segmentsOf(path);
      for (const route of routes) {
        if (route.method !== method || route.parts.length !== segs.length) continue;
        const params = {};
        if (route.parts.every((part, i) => (part.startsWith(':') ? ((params[part.slice(1)] = segs[i]), true) : part === segs[i]))) {
          return { handler: route.handler, params };
        }
      }
      return null;
    },
  };
}
