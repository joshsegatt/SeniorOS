/** The shop ships from Germany. */
export const HOME_COUNTRY = 'DE';

/** Countries we ship to, by ISO 3166 code. `vat`: the VAT rate charged on deliveries there. */
export const COUNTRIES = {
  DE: { name: 'Germany', eu: true, vat: 0.19 },
  AT: { name: 'Austria', eu: true, vat: 0.2 },
  FR: { name: 'France', eu: true, vat: 0.2 },
  NL: { name: 'Netherlands', eu: true, vat: 0.21 },
  IT: { name: 'Italy', eu: true, vat: 0.22 },
  CH: { name: 'Switzerland', eu: false, vat: 0 },
  GB: { name: 'United Kingdom', eu: false, vat: 0 },
  US: { name: 'United States', eu: false, vat: 0 },
};

/** @param {string} code */
export function countryName(code) {
  return COUNTRIES[code]?.name ?? code;
}

/** ISO code for a country given by code ("de") or by name ("Germany"); null if we don't ship there. @param {unknown} value */
export function findCountryCode(value) {
  const v = String(value ?? '').trim();
  if (Object.hasOwn(COUNTRIES, v.toUpperCase())) return v.toUpperCase();
  const byName = Object.entries(COUNTRIES).find(([, c]) => c.name.toLowerCase() === v.toLowerCase());
  return byName ? byName[0] : null;
}
