/**
 * In-memory implementation of the document database client, used in development and tests.
 * Same interface as the HTTP client in `http.js`.
 *
 * Filters: `{ field: value }` matches equal values, `{ field: { $in: [a, b] } }` matches any of the values.
 * All fields of a filter must match.
 * @typedef {Record<string, unknown>} Doc
 * @typedef {Record<string, unknown | { $in: unknown[] }>} Filter
 * @typedef {{ find(collection: string, filter?: Filter): Promise<Doc[]>, findOne(collection: string, filter?: Filter): Promise<Doc | null> }} Db
 */

/** @param {Doc} doc @param {Filter} filter */
function matches(doc, filter) {
  return Object.entries(filter).every(([field, cond]) => {
    if (cond && typeof cond === 'object' && Array.isArray(/** @type {any} */ (cond).$in)) return /** @type {any} */ (cond).$in.includes(doc[field]);
    return doc[field] === cond;
  });
}

/**
 * @param {Record<string, Doc[]>} collections
 * @returns {Db}
 */
export function createMemoryDb(collections = {}) {
  /** @param {string} name */
  const rows = (name) => collections[name] ?? [];
  return {
    async find(collection, filter = {}) {
      return rows(collection).filter((d) => matches(d, filter)).map((d) => ({ ...d }));
    },
    async findOne(collection, filter = {}) {
      const doc = rows(collection).find((d) => matches(d, filter));
      return doc ? { ...doc } : null;
    },
  };
}
