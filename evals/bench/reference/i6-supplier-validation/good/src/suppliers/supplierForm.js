import { validateContact } from '../validate.js';

// Supplier contact form validation. Same contact block as customers
// (docs/validation.md). Returns { ok, errors }.
export function validateSupplier(input = {}) {
  return validateContact(input);
}
