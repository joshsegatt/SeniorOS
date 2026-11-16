import { pathToFileURL } from 'node:url';
import { openFileStore } from '../src/db/store.js';

/**
 * One-off (2026-05): lowercase and trim customer emails so login and the newsletter match them.
 * @param {ReturnType<import('../src/db/store.js').createStore>} store
 */
export function run(store) {
  let changed = 0;
  for (const customer of store.all('customers')) {
    const email = String(customer.email ?? '').trim().toLowerCase();
    if (email === customer.email) continue;
    store.replace('customers', customer.id, { ...customer, email });
    changed += 1;
  }
  return { changed };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  // Production points STORE_FILE at the database through the same interface; locally it is a JSON file.
  console.log(run(openFileStore(process.env.STORE_FILE ?? 'data/store.json')));
}
