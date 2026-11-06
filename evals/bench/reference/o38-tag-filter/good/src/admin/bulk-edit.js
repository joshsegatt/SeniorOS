import { normalizeTag } from '../blog/tags.js';

/** Tags typed in the bulk editor, stored like the post editor stores them. @param {string[] | undefined} values */
const cleanTags = (values) => (values ?? []).filter((t) => String(t ?? '').trim()).map(normalizeTag);

/**
 * Admin posts list: select several posts, then add or remove tags and/or publish them in one go.
 * @param {ReturnType<import('../blog/store.js').createPostStore>} store
 * @param {{ ids: string[], addTags?: string[], removeTags?: string[], publish?: boolean }} input
 * @param {() => Date} [now]
 */
export function bulkEdit(store, input, now = () => new Date()) {
  const ids = input.ids ?? [];
  if (!ids.length) throw new Error('select at least one post');
  const add = cleanTags(input.addTags);
  const remove = cleanTags(input.removeTags);
  const at = now().toISOString();
  return ids.map((id) => {
    const post = store.get(id);
    if (!post) throw new Error(`unknown post ${id}`);
    const tags = post.tags.filter((t) => !remove.includes(t));
    for (const t of add) if (!tags.includes(t)) tags.push(t);
    /** @type {Partial<import('../blog/store.js').Post>} */
    const patch = { tags };
    if (input.publish && !post.publishedAt) patch.publishedAt = at;
    return store.update(id, patch);
  });
}
