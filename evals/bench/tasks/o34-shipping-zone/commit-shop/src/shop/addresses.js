import { COUNTRIES, countryName } from './countries.js';

/** @typedef {import('./store.js').Address} Address */

/** @param {Record<string, unknown>} input */
export function cleanAddressFields(input) {
  /** @type {Record<string, string>} */
  const fields = {};
  for (const key of ['name', 'street', 'postcode', 'city']) {
    const value = String(input[key] ?? '').trim().replace(/\s+/g, ' ');
    if (!value) throw new Error(`${key} is required`);
    fields[key] = value;
  }
  return /** @type {{ name: string, street: string, postcode: string, city: string }} */ (fields);
}

/**
 * Web checkout: the customer fills in the address form (the country is a <select> of ISO codes).
 * @param {ReturnType<import('./store.js').createShopStore>} store
 * @param {string} customerId
 * @param {{ name: string, street: string, postcode: string, city: string, country: string }} input
 */
export function saveCheckoutAddress(store, customerId, input) {
  const country = String(input.country ?? '').trim().toUpperCase();
  if (!Object.hasOwn(COUNTRIES, country)) throw new Error(`we don't ship to ${input.country}`);
  return store.insertAddress({ customerId, ...cleanAddressFields(input), country, createdVia: 'web' });
}

/** One line for the address book and the order confirmation. @param {Address} address */
export function formatAddress(address) {
  return `${address.name}, ${address.street}, ${address.postcode} ${address.city}, ${countryName(address.country)}`;
}
