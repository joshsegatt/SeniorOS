import { loadPreferences } from '../settings/preferences.js';

/** @typedef {ReturnType<import('../settings/store.js').createDocStore>} DocStore */

/** Should the customer get this email? Order updates follow the email switch, the newsletter its own opt-in. @param {DocStore} store @param {string} userId @param {'order' | 'newsletter'} kind */
export function shouldEmail(store, userId, kind) {
  const prefs = loadPreferences(store, userId);
  return kind === 'newsletter' ? prefs.newsletter : prefs.channels.email;
}
