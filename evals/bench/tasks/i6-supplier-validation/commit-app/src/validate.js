import { COUNTRIES } from './countries.js';

// Field validators, written against docs/validation.md.

export function isBlank(value) {
  return value == null || String(value).trim() === '';
}

const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
export function isEmail(value) {
  return typeof value === 'string' && EMAIL.test(value.trim());
}

export function isPhone(value) {
  return typeof value === 'string' && /^\+[1-9]\d{7,14}$/.test(value.replace(/ /g, ''));
}

export function isCountry(value) {
  return COUNTRIES.includes(value);
}

const POSTAL = { CH: /^[1-9]\d{3}$/, DE: /^\d{5}$/, FR: /^\d{5}$/, IT: /^\d{5}$/ };
export function isPostalCode(country, value) {
  const re = POSTAL[country];
  return Boolean(re) && typeof value === 'string' && re.test(value.trim());
}
