/** @typedef {ReturnType<import('./store.js').createDocStore>} DocStore */

/** What a customer gets until they change it. Missing fields in a saved document take these values. */
export const DEFAULTS = Object.freeze({
  language: 'de',
  theme: 'system',
  newsletter: false,
  notify: Object.freeze({ email: true, sms: true }),
});

/** Fields a preferences document may hold. Anything else in a request is not saved. */
const KNOWN = ['language', 'theme', 'newsletter', 'notify'];

/** @param {Record<string, any>} doc */
const pickKnown = (doc) => Object.fromEntries(KNOWN.filter((k) => doc[k] !== undefined).map((k) => [k, doc[k]]));

/** The customer's effective preferences. @param {DocStore} store @param {string} userId */
export function loadPreferences(store, userId) {
  const doc = store.get(userId) ?? {};
  return { ...DEFAULTS, ...pickKnown(doc), notify: { ...DEFAULTS.notify, ...doc.notify } };
}

/**
 * Saves a change from the account settings page or the app. Only the fields in the patch change.
 * @param {DocStore} store
 * @param {string} userId
 * @param {{ language?: string, theme?: string, newsletter?: boolean, notify?: { email?: boolean, sms?: boolean } }} patch
 */
export function savePreferences(store, userId, patch) {
  const stored = store.get(userId) ?? {};
  store.put(userId, pickKnown({ ...stored, ...patch, notify: { ...stored.notify, ...patch.notify } }));
  return loadPreferences(store, userId);
}
