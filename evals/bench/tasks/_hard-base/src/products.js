import { slugify } from './slug.js';

/** @param {string} title */
export function productUrl(title) {
  return `/p/${slugify(title)}`;
}
