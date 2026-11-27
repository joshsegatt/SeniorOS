import { parseCsv } from './csv.js';
import { validateProduct } from './validate.js';
import { ImportRowError } from './errors.js';

function toRecord(header, row) {
  if (row.fields.length !== header.length) {
    throw new ImportRowError(
      'column_count',
      `expected ${header.length} fields, got ${row.fields.length}`,
      row.line,
    );
  }
  const record = {};
  header.forEach((column, i) => {
    record[column] = row.fields[i];
  });
  return record;
}

// Imports every valid row and reports each rejected row as
// { line, sku, reason, message } (docs/import-format.md).
// Only row validation errors are collected; anything else is a bug and throws.
export function importProducts(text, { catalog }) {
  const { header, rows } = parseCsv(text);
  const skuIndex = header.indexOf('sku');
  const imported = new Set();
  const errors = [];

  for (const row of rows) {
    try {
      const product = validateProduct(toRecord(header, row), row.line);
      if (imported.has(product.sku)) {
        throw new ImportRowError(
          'duplicate_sku',
          `sku "${product.sku}" was already imported from an earlier row`,
          row.line,
        );
      }
      catalog.upsert(product);
      imported.add(product.sku);
    } catch (err) {
      if (!(err instanceof ImportRowError)) throw err;
      errors.push({
        line: row.line,
        sku: skuIndex === -1 ? '' : (row.fields[skuIndex] ?? ''),
        reason: err.reason,
        message: err.message,
      });
    }
  }

  return { imported: imported.size, errors };
}
