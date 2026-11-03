import { existsSync, readFileSync } from 'node:fs';

/** The environment the app runs in: development (default), test or production. */
export const appEnv = process.env.APP_ENV || 'development';

/** @param {string} name */
function load(name) {
  const url = new URL(`../config/${name}.json`, import.meta.url);
  return existsSync(url) ? JSON.parse(readFileSync(url, 'utf8')) : {};
}

/** @param {any} base @param {any} over */
function merge(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(base[k] ?? {}, v) : v;
  return out;
}

/**
 * config/default.json overlaid with config/<APP_ENV>.json.
 * @type {{ shop: { name: string, timezone: string, currency: string }, dashboard: { refreshSeconds: number }, logLevel: string }}
 */
export const config = merge(load('default'), load(appEnv));
