import { readFile, writeFile } from 'node:fs/promises';

/** A turn of the event loop, like a round trip to the database. */
const io = () => new Promise((resolve) => setImmediate(resolve));

/**
 * In-memory backend for tests and local runs. Async on purpose, like the file and the database.
 * @returns {{ read(key: string): Promise<any>, write(key: string, value: any): Promise<void>, keys(): Promise<string[]> }}
 */
export function memoryBackend() {
  /** @type {Map<string, string>} */
  const rows = new Map();
  return {
    async read(key) {
      await io();
      const raw = rows.get(key);
      return raw === undefined ? null : JSON.parse(raw);
    },
    async write(key, value) {
      await io();
      rows.set(key, JSON.stringify(value));
    },
    async keys() {
      await io();
      return [...rows.keys()];
    },
  };
}

/**
 * JSON file backend used in production (one object keyed by card code).
 * @param {string} path
 */
export function fileBackend(path) {
  async function load() {
    try {
      return JSON.parse(await readFile(path, 'utf8'));
    } catch (error) {
      if (/** @type {NodeJS.ErrnoException} */ (error).code === 'ENOENT') return {};
      throw error;
    }
  }
  // Writes rewrite the whole file, so they go one at a time: two cards saved at once must not drop each other.
  /** @type {Promise<unknown>} */
  let writes = Promise.resolve();
  return {
    /** @param {string} key */
    async read(key) {
      const all = await load();
      return all[key] ?? null;
    },
    /** @param {string} key @param {any} value */
    write(key, value) {
      const next = writes.then(async () => {
        const all = await load();
        all[key] = value;
        await writeFile(path, JSON.stringify(all, null, 2));
      });
      writes = next.catch(() => {});
      return next;
    },
    async keys() {
      return Object.keys(await load());
    },
  };
}
