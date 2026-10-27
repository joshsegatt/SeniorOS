/**
 * URL slug that keeps accented letters. Storage keys keep using the ASCII `slugify` (see .senior/decisions.md).
 * @param {string} title
 */
function urlSlug(title) {
  return title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
}

/** @param {string} title */
export function productUrl(title) {
  return `/p/${urlSlug(title)}`;
}
