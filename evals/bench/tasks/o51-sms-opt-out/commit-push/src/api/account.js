import { savePreferences } from '../settings/preferences.js';

/** @typedef {ReturnType<import('../settings/store.js').createDocStore>} DocStore */

const LANGUAGES = ['de', 'fr', 'it', 'en'];
const THEMES = ['system', 'light', 'dark'];
const CHANNELS = ['email', 'sms', 'push'];

/** @param {unknown} body @returns {string | null} what is wrong with the request */
function invalid(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'body must be an object';
  const b = /** @type {Record<string, any>} */ (body);
  for (const key of Object.keys(b)) if (!['language', 'theme', 'newsletter', 'channels'].includes(key)) return `unknown field ${key}`;
  if (b.language !== undefined && !LANGUAGES.includes(b.language)) return 'unsupported language';
  if (b.theme !== undefined && !THEMES.includes(b.theme)) return 'unsupported theme';
  if (b.newsletter !== undefined && typeof b.newsletter !== 'boolean') return 'newsletter must be true or false';
  if (b.channels !== undefined) {
    if (!b.channels || typeof b.channels !== 'object') return 'channels must be an object';
    for (const [k, v] of Object.entries(b.channels)) {
      if (!CHANNELS.includes(k)) return `unknown channel ${k}`;
      if (typeof v !== 'boolean') return `${k} must be true or false`;
    }
  }
  return null;
}

/** `PATCH /v1/account/preferences` from the settings page and the app. @param {DocStore} store @param {string} userId @param {unknown} body */
export function patchPreferences(store, userId, body) {
  const error = invalid(body);
  if (error) return { status: 400, body: { error } };
  return { status: 200, body: savePreferences(store, userId, /** @type {any} */ (body)) };
}
