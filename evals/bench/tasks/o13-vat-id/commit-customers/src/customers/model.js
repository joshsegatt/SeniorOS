/**
 * @typedef {{ id: string, name: string, email: string, phone: string | null, createdAt: string }} Customer
 * @typedef {{ name?: unknown, email?: unknown, phone?: unknown }} CustomerInput
 */

/** Phone numbers are stored without spaces, dashes or parentheses: "+351 912-345 678" → "+351912345678". @param {string} raw */
export function normalizePhone(raw) {
  return String(raw).replace(/[\s\-()]/g, '');
}

/**
 * Validates a new customer, or with `partial` only the fields present (for edits).
 * `phone` is optional: null or an empty string clears it.
 * @param {CustomerInput} input
 * @param {{ partial?: boolean }} [options]
 * @returns {{ ok: true, value: Partial<Customer> } | { ok: false, errors: Record<string, string> }}
 */
export function validateCustomer(input, { partial = false } = {}) {
  /** @type {Record<string, string>} */
  const errors = {};
  /** @type {Partial<Customer>} */
  const value = {};

  if (!partial || 'name' in input) {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!name) errors.name = 'name is required';
    else value.name = name;
  }
  if (!partial || 'email' in input) {
    const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'invalid email';
    else value.email = email;
  }
  if ('phone' in input) {
    if (input.phone === null || input.phone === '') value.phone = null;
    else {
      const phone = typeof input.phone === 'string' ? normalizePhone(input.phone) : '';
      if (!/^\+?[0-9]{7,15}$/.test(phone)) errors.phone = 'invalid phone';
      else value.phone = phone;
    }
  } else if (!partial) {
    value.phone = null;
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}
