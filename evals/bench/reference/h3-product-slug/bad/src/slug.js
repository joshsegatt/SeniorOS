/**
 * Lowercase, dash-separated slug that keeps accented letters.
 * @param {string} text
 */
export function slugify(text) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
}
