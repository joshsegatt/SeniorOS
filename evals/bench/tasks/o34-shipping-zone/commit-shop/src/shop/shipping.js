import { COUNTRIES, HOME_COUNTRY } from './countries.js';

export const DOMESTIC_RATE = 490;
export const EU_RATE = 990;
export const INTERNATIONAL_RATE = 2490;

/** Shipping charged for an order to this address, in cents. @param {import('./store.js').Address} address */
export function shippingRate(address) {
  if (address.country === HOME_COUNTRY) return DOMESTIC_RATE;
  if (COUNTRIES[address.country]?.eu) return EU_RATE;
  return INTERNATIONAL_RATE;
}
