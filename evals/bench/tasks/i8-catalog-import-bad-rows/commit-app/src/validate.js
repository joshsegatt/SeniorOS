import { ImportRowError } from './errors.js';
import { toCents } from './cents.js';

// record: { sku, name, description, price, stock } as raw strings.
// Returns a catalog product or throws ImportRowError.
export function validateProduct(record, line) {
  const sku = (record.sku ?? '').trim();
  const name = (record.name ?? '').trim();
  if (!sku) throw new ImportRowError('missing_sku', 'sku is empty', line);
  if (!name) throw new ImportRowError('missing_name', 'name is empty', line);

  const priceCents = toCents(record.price ?? '');
  if (priceCents === null) {
    throw new ImportRowError('invalid_price', `price "${record.price}" is not a valid amount`, line);
  }

  const stock = record.stock ?? '';
  if (!/^\d+$/.test(stock)) {
    throw new ImportRowError('invalid_stock', `stock "${stock}" is not a whole number`, line);
  }

  return {
    sku,
    name,
    description: record.description ?? '',
    priceCents,
    stock: Number(stock),
  };
}
