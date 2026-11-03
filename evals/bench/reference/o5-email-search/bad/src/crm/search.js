import { normalizeEmail } from './email.js';

/**
 * Support search: an exact email, or part of a name. Results sorted by name.
 * @param {ReturnType<import('./store.js').createStore>} store
 * @param {string} query
 */
export function searchCustomers(store, query) {
  const q = String(query ?? '').trim();
  if (!q) return [];
  const email = normalizeEmail(q);
  const needle = q.toLowerCase();
  return store
    .all()
    .filter((c) => normalizeEmail(c.email) === email || c.name.toLowerCase().includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name));
}
