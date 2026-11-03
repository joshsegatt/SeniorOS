import { config } from '../config.js';

/** Tabs and newlines would break the TSV. @param {string} s */
const clean = (s) => String(s).replace(/[\t\r\n]+/g, ' ').trim();

/**
 * Product feed for Google Merchant Center (TSV).
 * @param {ReturnType<import('../catalog/products.js').createProductStore>} store
 */
export function merchantFeed(store) {
  const base = config.shop.baseUrl.replace(/\/$/, '');
  // Prices are stored in the currency's minor unit: 2 decimals for EUR, none for JPY.
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency: config.shop.currency }).resolvedOptions().maximumFractionDigits ?? 2;
  const lines = [['id', 'title', 'link', 'price', 'availability'].join('\t')];
  for (const p of store.all()) {
    if (!p.active) continue;
    lines.push([
      clean(p.sku),
      clean(p.title),
      `${base}/p/${encodeURIComponent(p.sku)}`,
      `${(p.price / 10 ** digits).toFixed(digits)} ${config.shop.currency}`,
      p.stock > 0 ? 'in_stock' : 'out_of_stock',
    ].join('\t'));
  }
  return lines.join('\n') + '\n';
}
