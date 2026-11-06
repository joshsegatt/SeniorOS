import { COUNTRIES } from './countries.js';

/**
 * VAT rate for a delivery to this address: the destination country's rate inside the EU (OSS),
 * none for exports outside the EU.
 * @param {import('./store.js').Address} address
 */
export function vatRate(address) {
  const country = COUNTRIES[address.country];
  return country?.eu ? country.vat : 0;
}

/** VAT in cents on goods plus shipping. @param {import('./store.js').Address} address @param {number} netCents */
export function vatAmount(address, netCents) {
  return Math.round(netCents * vatRate(address));
}
