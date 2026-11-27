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

// The contact block shared by customers and suppliers (docs/validation.md).
export function validateContact(input = {}) {
  const errors = {};

  const name = String(input.name ?? '').trim();
  if (!name) errors.name = 'required';
  else if (name.length > 100) errors.name = 'invalid';

  if (isBlank(input.email)) errors.email = 'required';
  else if (!isEmail(input.email)) errors.email = 'invalid';

  if (!isBlank(input.phone) && !isPhone(input.phone)) errors.phone = 'invalid';

  if (isBlank(input.country)) errors.country = 'required';
  else if (!isCountry(input.country)) errors.country = 'invalid';

  if (isBlank(input.postalCode)) errors.postalCode = 'required';
  else if (isCountry(input.country) && !isPostalCode(input.country, input.postalCode)) errors.postalCode = 'invalid';

  return { ok: Object.keys(errors).length === 0, errors };
}
