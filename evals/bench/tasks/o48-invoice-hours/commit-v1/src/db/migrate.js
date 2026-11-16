import { migrations } from './migrations/index.js';

/**
 * Applies the migrations that have not run on this store yet, in order. Deploys run it before the new code
 * starts serving (`npm run migrate`).
 * @param {ReturnType<import('./store.js').createStore>} store
 */
export function migrate(store) {
  const applied = new Set(store.getMeta('migrations') ?? []);
  const ran = [];
  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;
    migration.up(store);
    applied.add(migration.id);
    store.setMeta('migrations', [...applied]);
    ran.push(migration.id);
  }
  return ran;
}
