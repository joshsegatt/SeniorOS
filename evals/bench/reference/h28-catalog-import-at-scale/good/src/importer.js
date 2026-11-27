import { parseRecords, lineAt, CsvError } from './csv.js';
import { validateRow } from './validate.js';

export class ImportError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ImportError';
  }
}

const REQUIRED = ['sku', 'name', 'price', 'currency'];
const OPTIONAL = ['stock', 'description'];

// Imports a supplier catalog CSV. See docs/import-format.md for the rules.
//
// existing: products already in the shop ([{ sku, ... }]); rows whose SKU is
// there become updates, the others creates.
//
// Linear in the file size: line numbers come from the parser's single pass,
// SKU lookups go through a Set / Map.
export function importCatalog(text, { existing = [] } = {}) {
  let records;
  try {
    records = parseRecords(text);
  } catch (err) {
    if (err instanceof CsvError) throw new ImportError(`line ${lineAt(text, err.offset)}: ${err.message}`);
    throw err;
  }
  if (records.length === 0) throw new ImportError('the file is empty');

  const header = records[0].fields.map((h) => h.trim().toLowerCase());
  const column = {};
  for (const name of [...REQUIRED, ...OPTIONAL]) column[name] = header.indexOf(name);
  const missing = REQUIRED.filter((name) => column[name] === -1);
  if (missing.length > 0) throw new ImportError(`missing column(s): ${missing.join(', ')}`);

  const existingSkus = new Set(existing.map((p) => p.sku));
  const stats = { created: 0, updated: 0, duplicates: 0, errors: 0 };
  const errors = [];
  const slots = []; // products in row order; a superseded row's slot becomes null
  const slotBySku = new Map();

  for (let i = 1; i < records.length; i++) {
    const { fields, line } = records[i];
    if (fields.length === 1 && fields[0] === '') continue; // blank line

    if (fields.length !== header.length) {
      errors.push({ line, sku: null, message: `expected ${header.length} fields, got ${fields.length}` });
      continue;
    }

    const row = {};
    for (const name of [...REQUIRED, ...OPTIONAL]) {
      if (column[name] !== -1) row[name] = fields[column[name]];
    }
    const result = validateRow(row);
    if (result.error) {
      errors.push({ line, sku: row.sku.trim() || null, message: result.error });
      continue;
    }

    const product = {
      ...result.product,
      line,
      action: existingSkus.has(result.product.sku) ? 'update' : 'create',
    };

    // Same SKU twice in one file: the later row wins and takes its place.
    const previous = slotBySku.get(product.sku);
    if (previous !== undefined) {
      slots[previous] = null;
      stats.duplicates++;
    }
    slotBySku.set(product.sku, slots.length);
    slots.push(product);
  }

  const products = slots.filter((p) => p !== null);
  for (const p of products) stats[p.action === 'update' ? 'updated' : 'created']++;
  stats.errors = errors.length;
  return { products, errors, stats };
}
