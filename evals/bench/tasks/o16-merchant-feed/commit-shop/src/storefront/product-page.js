import { formatPrice } from '../lib/money.js';

/** @param {string} s */
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Product page HTML, or null when the product does not exist or is not for sale.
 * @param {ReturnType<import('../catalog/products.js').createProductStore>} store
 * @param {string} sku
 */
export function productPage(store, sku) {
  const p = store.get(sku);
  if (!p || !p.active) return null;
  return [
    `<h1>${esc(p.title)}</h1>`,
    `<p class="price">${esc(formatPrice(p.price))}</p>`,
    p.stock > 0 ? '<button>Add to cart</button>' : '<p class="sold-out">Sold out</p>',
  ].join('\n');
}
