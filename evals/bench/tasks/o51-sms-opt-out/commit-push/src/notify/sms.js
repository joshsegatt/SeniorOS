import { loadPreferences } from '../settings/preferences.js';

/** @typedef {ReturnType<import('../settings/store.js').createDocStore>} DocStore */

/** Order updates by SMS (shipped, ready for pickup): phone numbers of the customers who still want them. @param {DocStore} store @param {{ id: string, phone: string | null }[]} customers */
export function smsRecipients(store, customers) {
  return customers.filter((c) => c.phone && loadPreferences(store, c.id).channels.sms).map((c) => c.phone);
}
