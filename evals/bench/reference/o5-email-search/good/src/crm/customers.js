import { isValidEmail, normalizeEmail } from './email.js';

/**
 * @param {ReturnType<import('./store.js').createStore>} store
 * @param {{ name: string, email: string }} input
 * @param {() => Date} [now]
 */
export function register(store, input, now = () => new Date()) {
  const name = String(input.name ?? '').trim();
  if (!name) throw new Error('name is required');
  if (!isValidEmail(input.email)) throw new Error('invalid email');
  if (store.findByEmail(input.email)) throw new Error('email already registered');
  return store.insert({ id: store.nextId(), name, email: normalizeEmail(input.email), source: 'signup', createdAt: now().toISOString() });
}

/**
 * Imports customers exported from the old shop (rows of the CSV, already parsed). Rows with an invalid email,
 * or an email we already have, are skipped.
 * @param {ReturnType<import('./store.js').createStore>} store
 * @param {{ name: string, email: string }[]} rows
 * @param {() => Date} [now]
 */
export function importCustomers(store, rows, now = () => new Date()) {
  const result = { imported: 0, skipped: 0 };
  for (const row of rows) {
    if (!isValidEmail(row.email) || store.findByEmail(row.email)) {
      result.skipped += 1;
      continue;
    }
    store.insert({ id: store.nextId(), name: String(row.name ?? '').trim(), email: normalizeEmail(row.email), source: 'import', createdAt: now().toISOString() });
    result.imported += 1;
  }
  return result;
}
