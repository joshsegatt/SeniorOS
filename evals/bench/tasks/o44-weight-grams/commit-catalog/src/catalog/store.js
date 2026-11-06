import { readFileSync } from 'node:fs';
import { readProduct } from './records.js';

const DATA_FILE = new URL('../../data/products.json', import.meta.url);

/**
 * In-memory catalog over saved product records (production uses the same interface over Postgres).
 * `get` and `all` return products through readProduct; `raw` and `put` deal in saved records.
 * @param {Record<string, any>[]} records
 */
export function createCatalog(records = []) {
  /** @type {Map<string, Record<string, any>>} */
  const rows = new Map(records.map((r) => [r.sku, { ...r }]));
  return {
    /** @param {string} sku */
    get(sku) {
      const row = rows.get(sku);
      return row ? readProduct(row) : null;
    },
    all() {
      return [...rows.values()].map(readProduct);
    },
    /** The saved record as stored. @param {string} sku */
    raw(sku) {
      const row = rows.get(sku);
      return row ? { ...row } : null;
    },
    /** Saves a record, replacing any record with the same sku. @param {Record<string, any>} record */
    put(record) {
      rows.set(record.sku, { ...record });
    },
  };
}

/** The catalog from data/products.json (or another file in the same format). @param {string | URL} [file] */
export function loadCatalog(file = DATA_FILE) {
  return createCatalog(JSON.parse(readFileSync(file, 'utf8')));
}
