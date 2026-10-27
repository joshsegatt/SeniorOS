/**
 * Lowercase, dash-separated ASCII slug.
 * @param {string} text
 */
export function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
