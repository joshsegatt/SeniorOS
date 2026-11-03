import { readFileSync } from 'node:fs';

/**
 * Production HTTP transport for the shop platform API.
 * @param {{ token: string, baseUrl?: string }} options
 */
export function createHttp({ token, baseUrl }) {
  const config = JSON.parse(readFileSync(new URL('../../config/shop-api.json', import.meta.url), 'utf8'));
  const base = baseUrl ?? config.baseUrl;
  return {
    /** @param {string} path @param {Record<string, unknown>} [query] */
    async get(path, query = {}) {
      const url = new URL(path, base);
      for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`shop API ${res.status} for ${path}`);
      return res.json();
    },
  };
}
