import { loadPreferences } from '../settings/preferences.js';

/** @typedef {ReturnType<import('../settings/store.js').createDocStore>} DocStore */

const LABELS = { email: 'Order updates by email', sms: 'Order updates by SMS' };

/** The account settings form, filled with the customer's preferences. @param {DocStore} store @param {string} userId */
export function settingsForm(store, userId) {
  const prefs = loadPreferences(store, userId);
  return {
    language: prefs.language,
    theme: prefs.theme,
    newsletter: prefs.newsletter,
    notifications: Object.entries(LABELS).map(([name, label]) => ({ name, label, checked: Boolean(prefs.notify[name]) })),
  };
}
