import { COUNTRIES } from '../countries.js';

// Customer contact form validation. Returns { ok, errors }.
export function validateCustomer(input = {}) {
  const errors = {};

  const name = String(input.name ?? '').trim();
  if (!name) errors.name = 'required';
  else if (name.length > 100) errors.name = 'invalid';

  const email = String(input.email ?? '').trim();
  if (!email) errors.email = 'required';
  else if (!/^[a-z0-9._-]+@[a-z0-9-]+\.[a-z]{2,}$/i.test(email)) errors.email = 'invalid';

  // TODO(#418): lets national numbers like "079 123 45 67" through and rejects
  // "+41 79 123 45 67". Should follow docs/validation.md (validate.isPhone).
  if (input.phone) {
    const digits = String(input.phone).replace(/\s/g, '');
    if (!/^\d{8,15}$/.test(digits)) errors.phone = 'invalid';
  }

  if (!input.country) errors.country = 'required';
  else if (!COUNTRIES.includes(input.country)) errors.country = 'invalid';

  const postal = String(input.postalCode ?? '').trim();
  if (!postal) errors.postalCode = 'required';
  else if (!/^\d{4,5}$/.test(postal)) errors.postalCode = 'invalid';

  return { ok: Object.keys(errors).length === 0, errors };
}
