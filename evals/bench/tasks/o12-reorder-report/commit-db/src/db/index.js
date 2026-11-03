import { createHttpDb } from './http.js';
import { createMemoryDb } from './memory.js';
import { seedCollections } from './seed.js';

/** Picks the database client for the environment. */
export function connect(env = process.env) {
  if (env.DB_URL) return createHttpDb({ url: env.DB_URL, token: env.DB_TOKEN ?? '' });
  return createMemoryDb(seedCollections());
}
