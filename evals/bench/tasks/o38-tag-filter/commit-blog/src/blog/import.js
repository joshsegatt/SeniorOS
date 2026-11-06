import { normalizeTags } from './tags.js';
import { uniqueSlug } from './posts.js';

/**
 * Imports a markdown post from the old static site:
 *
 *     ---
 *     title: Hello
 *     author: dana
 *     date: 2025-03-01
 *     tags: [news, Release Notes]
 *     ---
 *     body...
 *
 * Posts without a date are imported as drafts.
 * @param {ReturnType<import('./store.js').createPostStore>} store
 * @param {string} source
 * @param {() => Date} [now]
 */
export function importMarkdown(store, source, now = () => new Date()) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(source);
  if (!match) throw new Error('missing front matter');
  /** @type {Record<string, string>} */
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
  }
  const title = meta.title?.replace(/^["']|["']$/g, '');
  if (!title) throw new Error('title is required');
  const rawTags = (meta.tags ?? '').replace(/^\[|\]$/g, '').split(',').filter((t) => t.trim());
  return store.insert({
    id: store.nextId(),
    slug: uniqueSlug(store, title),
    title,
    body: match[2].trim(),
    author: meta.author || 'editorial',
    tags: normalizeTags(rawTags),
    createdAt: now().toISOString(),
    publishedAt: meta.date ? new Date(meta.date).toISOString() : null,
  });
}
