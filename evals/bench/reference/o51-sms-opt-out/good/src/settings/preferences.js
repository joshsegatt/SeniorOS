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
 * The stored document in the current shape. Documents saved before push notifications keep their channels under
 * `notify` (email and sms); the app may since have added `channels.push` to them, so both keys can be there. Values
 * under `channels` are newer and win; the rest comes from `notify`.
 * @param {DocStore} store
 * @param {string} userId
 * @returns {Record<string, any>}
 */
export function storedPreferences(store, userId) {
  const { notify, ...doc } = store.get(userId) ?? {};
  return notify ? { ...doc, channels: { ...notify, ...doc.channels } } : doc;
}

/** The customer's effective preferences. @param {DocStore} store @param {string} userId */
export function loadPreferences(store, userId) {
  const doc = storedPreferences(store, userId);
  return { ...DEFAULTS, ...pickKnown(doc), channels: { ...DEFAULTS.channels, ...doc.channels } };
}

/**
 * Saves a change from the account settings page or the app. Only the fields in the patch change.
 * @param {DocStore} store
 * @param {string} userId
 * @param {{ language?: string, theme?: string, newsletter?: boolean, channels?: { email?: boolean, sms?: boolean, push?: boolean } }} patch
 */
export function savePreferences(store, userId, patch) {
  const stored = storedPreferences(store, userId);
  store.put(userId, pickKnown({ ...stored, ...patch, channels: { ...stored.channels, ...patch.channels } }));
  return loadPreferences(store, userId);
}
