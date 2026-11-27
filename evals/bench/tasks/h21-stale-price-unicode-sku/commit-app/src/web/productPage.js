import { formatChf } from '../format/money.js';

// Product detail page: /p/<encoded sku>. Links are built from product.sku.

export function productPath(product) {
  return `/p/${encodeURIComponent(product.sku)}`;
}

export function skuFromPath(path) {
  const m = /^\/p\/([^/?#]+)/.exec(String(path));
  if (!m) return null;
  try {
    const sku = decodeURIComponent(m[1]);
    return sku.trim() ? sku : null;
  } catch {
    return null;
  }
}

export function renderProductPage(app, path) {
  const sku = skuFromPath(path);
  const product = sku ? app.catalog.get(sku) : null;
  if (!product) return { status: 404, headers: { 'cache-control': 'no-store' }, body: 'Not found' };
  const gross = app.prices.priceFor(sku, product);
  return {
    status: 200,
    headers: { 'cache-control': 'public, max-age=60' },
    title: product.name,
    price: formatChf(gross),
    grossCents: gross,
    addToCart: { sku: product.sku },
  };
}

/** "Notify me when the price drops" button on the product page. */
export function subscribeFromProductPage(app, path, email) {
  const sku = skuFromPath(path);
  if (!sku || !app.catalog.get(sku)) return { status: 404 };
  app.alerts.subscribe(email, sku);
  return { status: 204 };
}
