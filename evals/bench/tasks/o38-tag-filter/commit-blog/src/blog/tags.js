/** @typedef {ReturnType<import('./store.js').createPostStore>} PostStore */

/** A tag as we store it: "  #Release  Notes " -> "release notes". @param {unknown} value */
export function normalizeTag(value) {
  const tag = String(value ?? '').trim().replace(/^#+/, '').trim().replace(/\s+/g, ' ').toLowerCase();
  if (!tag) throw new Error('tag is empty');
  return tag;
}

/** @param {unknown[]} values */
export function normalizeTags(values) {
  return [...new Set(values.map(normalizeTag))];
}

/** @param {{ publishedAt: string | null }} a @param {{ publishedAt: string | null }} b */
export const newestFirst = (a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt));

/**
 * The tag page: published posts with the tag, newest first.
 * @param {PostStore} store
 * @param {string} tag
 */
export function postsByTag(store, tag) {
  const wanted = normalizeTag(tag);
  return store.all().filter((p) => p.publishedAt && p.tags.includes(wanted)).sort(newestFirst);
}

/**
 * The tag cloud in the sidebar: how many published posts use each tag, most used first.
 * @param {PostStore} store
 */
export function tagCloud(store) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const post of store.all()) {
    if (!post.publishedAt) continue;
    for (const tag of post.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
