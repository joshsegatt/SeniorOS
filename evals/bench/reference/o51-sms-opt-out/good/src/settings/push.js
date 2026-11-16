import { loadPreferences, storedPreferences } from './preferences.js';

/** @typedef {ReturnType<import('./store.js').createDocStore>} DocStore */

/**
 * The mobile app calls this when the customer allows or blocks notifications on the phone
 * (`POST /v1/account/push`). Device tokens are registered separately by the app.
 * @param {DocStore} store
 * @param {string} userId
 * @param {boolean} enabled
 */
export function setPushEnabled(store, userId, enabled) {
  const doc = storedPreferences(store, userId);
  store.put(userId, { ...doc, channels: { ...doc.channels, push: Boolean(enabled) } });
}

/** Order updates as push notifications. @param {DocStore} store @param {string} userId */
export function shouldPush(store, userId) {
  return loadPreferences(store, userId).channels.push;
}
