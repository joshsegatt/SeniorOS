import { cleanAddressFields } from '../shop/addresses.js';
import { findCountryCode } from '../shop/countries.js';

/**
 * POST /api/v2/me/addresses, used by the iOS and Android apps (the address screen's country picker).
 * @param {ReturnType<import('../shop/store.js').createShopStore>} store
 * @param {string} customerId
 * @param {{ name?: string, street?: string, postcode?: string, city?: string, country?: string }} body
 * @returns {{ status: number, body: unknown }}
 */
export function postAddress(store, customerId, body) {
  if (!body || typeof body !== 'object') return { status: 400, body: { error: 'invalid body' } };
  if (!findCountryCode(body.country)) return { status: 422, body: { error: `we don't ship to ${body.country}` } };
  let fields;
  try {
    fields = cleanAddressFields(body);
  } catch (err) {
    return { status: 422, body: { error: /** @type {Error} */ (err).message } };
  }
  const address = store.insertAddress({ customerId, ...fields, country: /** @type {string} */ (findCountryCode(body.country)), createdVia: 'app' });
  return { status: 201, body: address };
}
