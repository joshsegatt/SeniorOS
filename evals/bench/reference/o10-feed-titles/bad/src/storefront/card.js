import { escapeHtml } from '../lib/html.js';

/** @param {number} cents */
const euros = (cents) => `€${(cents / 100).toFixed(2)}`;

const DECODE = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

/**
 * Names imported from the supplier feed are already escaped; decode them first so they are escaped exactly once.
 * @param {string} text
 */
function decodeEntities(text) {
  return String(text).replace(/&(?:amp|lt|gt|quot|#39);/g, (e) => DECODE[/** @type {keyof typeof DECODE} */ (e)]);
}

/**
 * Product tile on category and search pages.
 * @param {import('../catalog/store.js').Product} product
 */
export function renderProductCard(product) {
  const name = escapeHtml(decodeEntities(product.name));
  return [
    `<article class="product-card" data-sku="${escapeHtml(product.sku)}">`,
    `  <a href="/p/${encodeURIComponent(product.sku)}" title="${name}">`,
    `    <h3>${name}</h3>`,
    `    <p class="price">${euros(product.priceCents)}</p>`,
    '  </a>',
    '</article>',
  ].join('\n');
}
