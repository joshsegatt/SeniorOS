/**
 * Data for the post page template: title, byline, body and the tag links under the title.
 * @param {ReturnType<import('../blog/store.js').createPostStore>} store
 * @param {string} slug
 */
export function postPage(store, slug) {
  const post = store.bySlug(slug);
  if (!post || !post.publishedAt) return null;
  return {
    title: post.title,
    byline: `${post.author}, ${post.publishedAt.slice(0, 10)}`,
    body: post.body,
    tags: post.tags.map((name) => ({ name, href: `/tags/${encodeURIComponent(name)}` })),
  };
}
