import { newestFirst, normalizeTag } from './tags.js';

/** @param {string} s */
const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * RSS 2.0 feed for one tag (/tags/<tag>/rss.xml): the latest published posts with the tag.
 * @param {ReturnType<import('./store.js').createPostStore>} store
 * @param {string} tag
 * @param {{ siteUrl?: string, limit?: number }} [options]
 */
export function tagFeed(store, tag, { siteUrl = 'https://blog.example.com', limit = 20 } = {}) {
  const wanted = normalizeTag(tag);
  const items = store
    .all()
    .filter((p) => p.publishedAt && p.tags.includes(wanted))
    .sort(newestFirst)
    .slice(0, limit)
    .map((p) => {
      const link = `${siteUrl}/posts/${p.slug}`;
      const date = new Date(String(p.publishedAt)).toUTCString();
      return `<item><title>${xml(p.title)}</title><link>${link}</link><guid>${link}</guid><pubDate>${date}</pubDate></item>`;
    });
  const channel = `<title>${xml(wanted)}</title><link>${siteUrl}/tags/${encodeURIComponent(wanted)}</link>`;
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel>${channel}${items.join('')}</channel></rss>`;
}
