import { COUNTRIES, HOME_COUNTRY, findCountryCode } from './countries.js';

export const DOMESTIC_RATE = 490;
export const EU_RATE = 990;
export const INTERNATIONAL_RATE = 2490;

/** Shipping charged for an order to this address, in cents. Addresses may hold a code or a country name. @param {import('./store.js').Address} address */
export function shippingRate(address) {
  const country = findCountryCode(address.country) ?? address.country;
  if (country === HOME_COUNTRY) return DOMESTIC_RATE;
  if (COUNTRIES[country]?.eu) return EU_RATE;
  return INTERNATIONAL_RATE;
}
