import { cleanAddressFields } from '../shop/addresses.js';
import { COUNTRIES } from '../shop/countries.js';

const COLUMNS = ['customer_id', 'name', 'street', 'postcode', 'city', 'country'];

/**
 * Imports addresses from the B2B customer CSV the sales team exports from the ERP
 * (header row, comma-separated, country as ISO code).
 * @param {ReturnType<import('../shop/store.js').createShopStore>} store
 * @param {string} csv
 * @returns {{ imported: string[], errors: { line: number, error: string }[] }}
 */
export function importAddressesCsv(store, csv) {
  const [header, ...rows] = csv.split(/\r?\n/).filter((l) => l.trim());
  if (header?.split(',').map((h) => h.trim()).join(',') !== COLUMNS.join(',')) throw new Error(`expected columns ${COLUMNS.join(',')}`);
  /** @type {string[]} */
  const imported = [];
  /** @type {{ line: number, error: string }[]} */
  const errors = [];
  rows.forEach((row, i) => {
    const values = row.split(',').map((v) => v.trim());
    const record = Object.fromEntries(COLUMNS.map((c, j) => [c, values[j] ?? '']));
    const country = record.country.toUpperCase();
    try {
      if (!Object.hasOwn(COUNTRIES, country)) throw new Error(`unknown country ${record.country}`);
      const address = store.insertAddress({ customerId: record.customer_id, ...cleanAddressFields(record), country, createdVia: 'import' });
      imported.push(address.id);
    } catch (err) {
      errors.push({ line: i + 2, error: /** @type {Error} */ (err).message });
    }
  });
  return { imported, errors };
}
