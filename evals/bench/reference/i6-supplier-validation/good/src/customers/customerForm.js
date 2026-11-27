import { validateContact } from '../validate.js';

// Customer contact form validation. Returns { ok, errors } (docs/validation.md).
export function validateCustomer(input = {}) {
  return validateContact(input);
}
