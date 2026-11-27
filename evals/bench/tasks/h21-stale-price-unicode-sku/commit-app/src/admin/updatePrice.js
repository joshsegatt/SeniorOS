import { canonicalSku } from '../catalog/sku.js';

// Admin "change price" form. The SKU is typed by staff.

export function updatePrice(app, skuInput, netCents) {
  const sku = canonicalSku(skuInput);
  const product = app.catalog.get(sku);
  if (!product) throw new Error(`unknown sku ${skuInput}`);

  const before = app.prices.priceFor(sku, product);
  const updated = app.catalog.setPrice(sku, netCents);
  app.prices.invalidate(sku);
  const after = app.prices.priceFor(sku, updated);

  const notified = app.alerts.priceChanged(sku, before, after, updated);
  return { sku: updated.sku, before, after, notified };
}
