import { priceLines } from './pricing.js';

export class UnknownProduct extends Error {
  constructor(sku) {
    super(`unknown product ${sku}`);
    this.name = 'UnknownProduct';
  }
}

function merge(items) {
  const bySku = new Map();
  for (const { sku, qty } of items) bySku.set(sku, (bySku.get(sku) ?? 0) + qty);
  return [...bySku].map(([sku, qty]) => ({ sku, qty }));
}

export function checkout({ products, inventory, orders }, customerId, items) {
  if (!items.length) throw new Error('an order needs at least one item');
  const lines = merge(items).map(({ sku, qty }) => {
    const product = products[sku];
    if (!product) throw new UnknownProduct(sku);
    if (!Number.isInteger(qty) || qty < 1) throw new RangeError(`invalid quantity ${qty} for ${sku}`);
    return { sku, title: product.title, qty, unitCents: product.priceCents };
  });

  const reserved = [];
  try {
    for (const line of lines) {
      inventory.reserve(line.sku, line.qty);
      reserved.push(line);
    }
  } catch (err) {
    for (const line of reserved) inventory.release(line.sku, line.qty);
    throw err;
  }
  return orders.create({ customerId, lines, ...priceLines(lines) });
}
