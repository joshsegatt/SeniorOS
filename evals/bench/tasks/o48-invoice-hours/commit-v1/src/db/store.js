import { existsSync, readFileSync, writeFileSync } from 'node:fs';

/**
 * Document store: named collections of records with an `id`, plus a small `meta` map.
 * Production runs the same interface over Postgres (one jsonb table per collection).
 * @param {Record<string, any>} [seed]
 * @param {{ onWrite?: (data: Record<string, any>) => void }} [options]
 */
export function createStore(seed = {}, { onWrite } = {}) {
  /** @type {Record<string, any>} */
  const data = structuredClone({ meta: {}, ...seed });
  /** @param {string} name @returns {Record<string, any>[]} */
  const rows = (name) => (data[name] ??= []);
  const written = () => onWrite?.(data);
  return {
    /** @param {string} name */
    all(name) {
      return rows(name).map((r) => ({ ...r }));
    },
    /** @param {string} name @param {string} id */
    get(name, id) {
      const found = rows(name).find((r) => r.id === id);
      return found ? { ...found } : null;
    },
    /** @param {string} name @param {Record<string, any>} row */
    insert(name, row) {
      if (rows(name).some((r) => r.id === row.id)) throw new Error(`${name}: duplicate id ${row.id}`);
      rows(name).push({ ...row });
      written();
      return { ...row };
    },
    /** Replaces the whole record. @param {string} name @param {string} id @param {Record<string, any>} row */
    replace(name, id, row) {
      const i = rows(name).findIndex((r) => r.id === id);
      if (i < 0) throw new Error(`${name}: unknown id ${id}`);
      rows(name)[i] = { ...row, id };
      written();
      return { ...rows(name)[i] };
    },
    /** @param {string} prefix */
    nextId(prefix) {
      data.meta.seq = (data.meta.seq ?? 5000) + 1;
      written();
      return `${prefix}-${data.meta.seq}`;
    },
    /** @param {string} key */
    getMeta(key) {
      return structuredClone(data.meta[key]);
    },
    /** @param {string} key @param {unknown} value */
    setMeta(key, value) {
      data.meta[key] = structuredClone(value);
      written();
    },
    /** A copy of everything, for backups and tests. */
    dump() {
      return structuredClone(data);
    },
  };
}

/** Local development: a store kept in a JSON file, saved after every write. @param {string} file */
export function openFileStore(file) {
  const seed = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  return createStore(seed, { onWrite: (data) => writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`) });
}
