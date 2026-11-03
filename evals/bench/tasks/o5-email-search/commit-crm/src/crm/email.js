/**
 * Canonical form of an email address, used for storing and comparing customer emails.
 * @param {string} email
 */
export function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

/** @param {string} email */
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}
