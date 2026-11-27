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

export function importProducts(text, { catalog }) {
  const { header, rows } = parseCsv(text);
  let imported = 0;
  for (const row of rows) {
    const record = toRecord(header, row);
    const product = validateProduct(record, row.line);
    catalog.upsert(product);
    imported++;
  }
  return { imported };
}
