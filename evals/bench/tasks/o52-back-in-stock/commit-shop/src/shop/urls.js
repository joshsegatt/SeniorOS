export const SHOP_ORIGIN = 'https://shop.example';

/** @param {{ slug: string }} product */
export function productUrl(product) {
  return `${SHOP_ORIGIN}/products/${product.slug}`;
}
