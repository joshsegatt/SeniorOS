import { config } from '../config.js';

/** Tabs and newlines would break the TSV. @param {string} s */
const clean = (s) => String(s).replace(/[\t\r\n]+/g, ' ').trim();

/**
 * Product feed for Google Merchant Center (TSV).
 * @param {ReturnType<import('../catalog/products.js').createProductStore>} store
 */
export function merchantFeed(store) {
  const base = config.shop.baseUrl.replace(/\/$/, '');
  const lines = [['id', 'title', 'link', 'price', 'availability'].join('\t')];
  for (const p of store.all()) {
    if (!p.active) continue;
    lines.push([
      clean(p.sku),
      clean(p.title),
      `${base}/p/${encodeURIComponent(p.sku)}`,
      `${(p.price / 100).toFixed(2)} ${config.shop.currency}`,
      p.stock > 0 ? 'in_stock' : 'out_of_stock',
    ].join('\t'));
  }
  return lines.join('\n') + '\n';
}
