import { slugify } from './slug.js';

/**
 * Storage key of a product's main image.
 * @param {string} title
 */
export function imageKey(title) {
  return `img/${slugify(title)}.jpg`;
}
