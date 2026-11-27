import { formatChf } from '../format/money.js';

// GET /api/price?sku=...  used by the POS tablets in the shop.

export function getPrice(app, sku) {
  if (typeof sku !== 'string' || !sku.trim()) return { status: 400, error: 'sku required' };
  const product = app.catalog.get(sku);
  if (!product) return { status: 404, error: 'unknown sku' };
  const grossCents = app.prices.priceFor(sku, product);
  return { status: 200, sku: product.sku, name: product.name, grossCents, price: formatChf(grossCents) };
}
