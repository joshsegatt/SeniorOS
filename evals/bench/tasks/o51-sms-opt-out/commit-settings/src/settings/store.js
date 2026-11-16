/**
 * Customer preferences, one JSON document per customer (a jsonb column in production, same interface).
 * Documents are copied in and out, like rows read from the database.
 */
export function createDocStore() {
  /** @type {Map<string, string>} */
  const docs = new Map();
  return {
    /** @param {string} userId @returns {Record<string, any> | null} */
    get(userId) {
      const raw = docs.get(userId);
      return raw === undefined ? null : JSON.parse(raw);
    },
    /** @param {string} userId @param {Record<string, any>} doc */
    put(userId, doc) {
      docs.set(userId, JSON.stringify(doc));
    },
    ids() {
      return [...docs.keys()];
    },
  };
}

/** Loads documents exported from the database, `{ [userId]: doc }`. @param {Record<string, Record<string, any>>} data */
export function loadDocs(data) {
  const store = createDocStore();
  for (const [userId, doc] of Object.entries(data)) store.put(userId, doc);
  return store;
}
