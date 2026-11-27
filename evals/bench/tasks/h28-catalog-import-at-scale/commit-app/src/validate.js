import { parsePriceCents } from './money.js';

const SKU = /^[A-Z0-9][A-Z0-9-]{2,31}$/;
const CURRENCIES = new Set(['CHF', 'EUR', 'USD']);

// row: { sku, name, price, currency, stock?, description? } (raw strings)
// Returns { product } or { error }.
export function validateRow(row) {
  const sku = row.sku.trim();
  if (sku === '') return { error: 'missing sku' };
  if (!SKU.test(sku)) return { error: `invalid sku "${sku}"` };

  const name = row.name.trim();
  if (name === '') return { error: 'missing name' };

  const priceCents = parsePriceCents(row.price.trim());
  if (priceCents === null) return { error: `invalid price "${row.price}"` };

  const currency = row.currency.trim().toUpperCase();
  if (!CURRENCIES.has(currency)) return { error: `invalid currency "${row.currency}"` };

  const stockText = (row.stock ?? '').trim();
  if (stockText !== '' && !/^\d{1,9}$/.test(stockText)) return { error: `invalid stock "${row.stock}"` };
  const stock = stockText === '' ? 0 : Number(stockText);

  return { product: { sku, name, priceCents, currency, stock, description: row.description ?? '' } };
}
