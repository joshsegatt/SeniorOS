import { normalizeTags } from './tags.js';

/** @typedef {ReturnType<import('./store.js').createPostStore>} PostStore */

/** "Shipping 4.2: faster sync!" -> "shipping-4-2-faster-sync". @param {string} title */
export function slugify(title) {
  return title.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** @param {PostStore} store @param {string} title */
export function uniqueSlug(store, title) {
  const base = slugify(title) || 'post';
  let slug = base;
  for (let n = 2; store.bySlug(slug); n += 1) slug = `${base}-${n}`;
  return slug;
}

/**
 * Post editor: save a new post (a draft unless `publish` is set).
 * @param {PostStore} store
 * @param {{ title: string, body?: string, author: string, tags?: string[], publish?: boolean }} input
 * @param {() => Date} [now]
 */
export function createPost(store, input, now = () => new Date()) {
  const title = String(input.title ?? '').trim();
  if (!title) throw new Error('title is required');
  if (!input.author) throw new Error('author is required');
  const at = now().toISOString();
  return store.insert({
    id: store.nextId(),
    slug: uniqueSlug(store, title),
    title,
    body: String(input.body ?? ''),
    author: input.author,
    tags: normalizeTags(input.tags ?? []),
    createdAt: at,
    publishedAt: input.publish ? at : null,
  });
}

/** Post editor: save changes. @param {PostStore} store @param {string} id @param {Partial<{ title: string, body: string, tags: string[] }>} patch */
export function updatePost(store, id, patch) {
  const changes = { ...patch };
  if (patch.title !== undefined) {
    changes.title = String(patch.title).trim();
    if (!changes.title) throw new Error('title is required');
  }
  if (patch.tags) changes.tags = normalizeTags(patch.tags);
  return store.update(id, changes);
}

/** @param {PostStore} store @param {string} id @param {() => Date} [now] */
export function publishPost(store, id, now = () => new Date()) {
  const post = store.get(id);
  if (!post) throw new Error(`unknown post ${id}`);
  return post.publishedAt ? post : store.update(id, { publishedAt: now().toISOString() });
}
