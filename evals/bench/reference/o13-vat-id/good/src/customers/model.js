/**
 * @typedef {{ id: string, name: string, email: string, phone: string | null, vatId: string | null, createdAt: string }} Customer
 * @typedef {{ name?: unknown, email?: unknown, phone?: unknown, vatId?: unknown }} CustomerInput
 */

/** Phone numbers are stored without spaces, dashes or parentheses: "+351 912-345 678" → "+351912345678". @param {string} raw */
export function normalizePhone(raw) {
  return String(raw).replace(/[\s\-()]/g, '');
}

/** VAT IDs are stored compact and upper-case: "de 811.907-980" → "DE811907980". @param {string} raw */
export function normalizeVatId(raw) {
  return String(raw).replace(/[\s.\-]/g, '').toUpperCase();
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
  if ('vatId' in input) {
    if (input.vatId === null || input.vatId === '') value.vatId = null;
    else {
      const vatId = typeof input.vatId === 'string' ? normalizeVatId(input.vatId) : '';
      if (!/^[A-Z]{2}[0-9A-Z]{8,12}$/.test(vatId)) errors.vatId = 'invalid VAT ID';
      else value.vatId = vatId;
    }
  } else if (!partial) {
    value.vatId = null;
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}
