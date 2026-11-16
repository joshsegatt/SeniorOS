/**
 * In-memory tables (production uses the same interface over Postgres).
 * Rows are copied in and out, so callers never hold a live reference.
 * @param {Record<string, object[]>} [seed]
 */
export function createStore(seed = {}) {
  /** @type {Map<string, any[]>} */
  const tables = new Map();
  const table = (name) => {
    if (!tables.has(name)) tables.set(name, []);
    return tables.get(name);
  };
  for (const [name, rows] of Object.entries(seed)) for (const row of rows) table(name).push({ ...row });
  let seq = 100;
  return {
    /** @param {string} prefix */
    nextId(prefix) {
      seq += 1;
      return `${prefix}-${seq}`;
    },
    /** @param {string} name @param {object} row */
    insert(name, row) {
      table(name).push({ ...row });
      return { ...row };
    },
    /** All rows, in insertion order. @param {string} name */
    all(name) {
      return table(name).map((r) => ({ ...r }));
    },
    /** @param {string} name @param {(row: any) => boolean} match */
    find(name, match) {
      const found = table(name).find(match);
      return found ? { ...found } : null;
    },
    /** @param {string} name @param {(row: any) => boolean} match @param {object} patch */
    update(name, match, patch) {
      const found = table(name).find(match);
      if (!found) return null;
      Object.assign(found, patch);
      return { ...found };
    },
    /** Deletes matching rows and returns how many. @param {string} name @param {(row: any) => boolean} match */
    remove(name, match) {
      const rows = table(name);
      const keep = rows.filter((r) => !match(r));
      const removed = rows.length - keep.length;
      rows.splice(0, rows.length, ...keep);
      return removed;
    },
  };
}
