/** @typedef {ReturnType<import('./store.js').createDocStore>} DocStore */

/** What a customer gets until they change it. Missing fields in a saved document take these values. */
export const DEFAULTS = Object.freeze({
  language: 'de',
  theme: 'system',
  newsletter: false,
  channels: Object.freeze({ email: true, sms: true, push: false }),
});

/** Fields a preferences document may hold. Anything else in a request is not saved. */
const KNOWN = ['language', 'theme', 'newsletter', 'channels'];

/** @param {Record<string, any>} doc */
const pickKnown = (doc) => Object.fromEntries(KNOWN.filter((k) => doc[k] !== undefined).map((k) => [k, doc[k]]));

/**
 * The customer's effective preferences. Documents saved before push notifications keep their channels under
 * `notify` (email and sms).
 * @param {DocStore} store
 * @param {string} userId
 */
export function loadPreferences(store, userId) {
  const doc = store.get(userId) ?? {};
  return { ...DEFAULTS, ...pickKnown(doc), channels: { ...DEFAULTS.channels, ...(doc.channels ?? doc.notify) } };
}

/**
 * Saves a change from the account settings page or the app. Only the fields in the patch change.
 * @param {DocStore} store
 * @param {string} userId
 * @param {{ language?: string, theme?: string, newsletter?: boolean, channels?: { email?: boolean, sms?: boolean, push?: boolean } }} patch
 */
export function savePreferences(store, userId, patch) {
  // Start from the loaded preferences, so channels saved under the old notify key are carried over.
  const current = loadPreferences(store, userId);
  store.put(userId, pickKnown({ ...current, ...patch, channels: { ...current.channels, ...patch.channels } }));
  return loadPreferences(store, userId);
}
