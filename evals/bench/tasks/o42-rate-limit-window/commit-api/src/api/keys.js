/** Partner API keys. In production these come from the partners table; tests use the seed. */
export function defaultKeys() {
  return new Map([
    ['pk_test_north', { partner: 'north-books', scopes: ['catalogue:read'] }],
    ['pk_test_lumen', { partner: 'lumen-outdoor', scopes: ['catalogue:read', 'stock:read'] }],
  ]);
}

/**
 * @param {Map<string, { partner: string, scopes: string[] }>} keys
 * @param {Record<string, string> | undefined} headers
 */
export function resolveKey(keys, headers = {}) {
  const key = headers['x-api-key'] ?? headers['X-Api-Key'];
  if (!key) return null;
  const record = keys.get(key);
  return record ? { key, ...record } : null;
}
