import { formatPrice, getProduct, isSoldOut } from '../catalog/products.js';
import { productUrl } from './urls.js';

/**
 * Storefront product page.
 * @param {ReturnType<import('../catalog/store.js').createStore>} store
 * @param {string} sku
 */
export function productPage(store, sku) {
  const product = getProduct(store, sku);
  const soldOut = isSoldOut(product);
  return {
    title: product.title,
    price: formatPrice(product.priceCents),
    url: productUrl(product),
    soldOut,
    addToCart: !soldOut,
    notifyMe: soldOut,
    stockNote: soldOut ? 'Sold out' : product.stock <= 3 ? `Only ${product.stock} left` : null,
  };
}
