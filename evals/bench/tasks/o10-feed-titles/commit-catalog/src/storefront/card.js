import { escapeHtml } from '../lib/html.js';

/** @param {number} cents */
const euros = (cents) => `€${(cents / 100).toFixed(2)}`;

/**
 * Product tile on category and search pages.
 * @param {import('../catalog/store.js').Product} product
 */
export function renderProductCard(product) {
  const name = escapeHtml(product.name);
  return [
    `<article class="product-card" data-sku="${escapeHtml(product.sku)}">`,
    `  <a href="/p/${encodeURIComponent(product.sku)}" title="${name}">`,
    `    <h3>${name}</h3>`,
    `    <p class="price">${euros(product.priceCents)}</p>`,
    '  </a>',
    '</article>',
  ].join('\n');
}
