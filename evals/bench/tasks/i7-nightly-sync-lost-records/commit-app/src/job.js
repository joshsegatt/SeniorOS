import { syncContacts } from './sync.js';

export const LAST_RUN_KEY = 'sync:lastRun';

// Cron entry point. Records when the last successful run finished.
export async function runNightly({ remote, store, now = () => new Date(), log = console.log }) {
  const startedAt = now().toISOString();
  const result = await syncContacts({ remote, store, log });
  await store.save(LAST_RUN_KEY, { startedAt, finishedAt: now().toISOString(), ...result });
  log(`nightly sync done: ${result.pages} pages`);
  return result;
}
