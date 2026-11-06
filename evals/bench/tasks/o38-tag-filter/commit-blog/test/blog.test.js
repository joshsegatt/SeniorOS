import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostStore } from '../src/blog/store.js';
import { createPost, publishPost, updatePost } from '../src/blog/posts.js';
import { importMarkdown } from '../src/blog/import.js';
import { normalizeTag, postsByTag, tagCloud } from '../src/blog/tags.js';
import { tagFeed } from '../src/blog/feed.js';
import { bulkEdit } from '../src/admin/bulk-edit.js';
import { postPage } from '../src/web/post-page.js';

const t0 = new Date('2026-10-01T09:00:00Z');
const at = (days) => () => new Date(t0.getTime() + days * 86_400_000);
const slugs = (posts) => posts.map((p) => p.slug);

test('tags are stored in one form', () => {
  assert.equal(normalizeTag('  #Release  Notes '), 'release notes');
  assert.throws(() => normalizeTag(' # '), /empty/);
  const store = createPostStore();
  const post = createPost(store, { title: 'Hello world', author: 'dana', tags: ['News', 'news ', 'Product'] }, at(0));
  assert.deepEqual(post.tags, ['news', 'product']);
  assert.equal(post.slug, 'hello-world');
  assert.equal(createPost(store, { title: 'Hello, World!', author: 'dana' }, at(0)).slug, 'hello-world-2');
});

test('the tag page lists published posts with the tag, newest first', () => {
  const store = createPostStore();
  createPost(store, { title: 'Release 1', author: 'dana', tags: ['Release Notes'], publish: true }, at(0));
  createPost(store, { title: 'Release 2', author: 'dana', tags: ['release notes'], publish: true }, at(5));
  const draft = createPost(store, { title: 'Release 3', author: 'dana', tags: ['release notes'] }, at(6));
  createPost(store, { title: 'Hiring', author: 'sam', tags: ['team'], publish: true }, at(7));
  assert.deepEqual(slugs(postsByTag(store, 'Release Notes')), ['release-2', 'release-1']);
  publishPost(store, draft.id, at(8));
  assert.deepEqual(slugs(postsByTag(store, 'release notes')), ['release-3', 'release-2', 'release-1']);
  updatePost(store, draft.id, { tags: ['Team'] });
  assert.deepEqual(slugs(postsByTag(store, 'team')), ['release-3', 'hiring']);
  assert.deepEqual(slugs(postsByTag(store, 'release notes')), ['release-2', 'release-1']);
});

test('the tag cloud and the tag feed', () => {
  const store = createPostStore();
  createPost(store, { title: 'Release 1', author: 'dana', tags: ['Release Notes', 'product'], publish: true }, at(0));
  createPost(store, { title: 'Release 2 & more', author: 'dana', tags: ['release notes'], publish: true }, at(5));
  createPost(store, { title: 'Draft', author: 'dana', tags: ['product'] }, at(6));
  assert.deepEqual(tagCloud(store), [{ tag: 'release notes', count: 2 }, { tag: 'product', count: 1 }]);
  const rss = tagFeed(store, 'Release Notes');
  assert.equal(rss.match(/<item>/g)?.length, 2);
  assert.ok(rss.indexOf('Release 2 &amp; more') < rss.indexOf('Release 1'));
  assert.ok(rss.includes('<guid>https://blog.example.com/posts/release-1</guid>'));
});

test('importing markdown posts from the old site', () => {
  const store = createPostStore();
  const post = importMarkdown(store, '---\ntitle: "Release notes: 3.9"\nauthor: dana\ndate: 2025-03-01\ntags: [Release Notes, product]\n---\nSmaller fixes.\n', at(0));
  assert.deepEqual(post.tags, ['release notes', 'product']);
  assert.equal(post.publishedAt, '2025-03-01T00:00:00.000Z');
  assert.deepEqual(slugs(postsByTag(store, 'release notes')), ['release-notes-3-9']);
  assert.equal(importMarkdown(store, '---\ntitle: Notes\n---\n', at(0)).publishedAt, null);
  assert.throws(() => importMarkdown(store, 'no front matter'), /front matter/);
});

test('the bulk editor tags and publishes several posts', () => {
  const store = createPostStore();
  const a = createPost(store, { title: 'One', author: 'dana', tags: ['news'] }, at(0));
  const b = createPost(store, { title: 'Two', author: 'dana', tags: ['draft'] }, at(0));
  bulkEdit(store, { ids: [a.id, b.id], addTags: ['product', ''], removeTags: ['draft'], publish: true }, at(3));
  assert.deepEqual(store.get(a.id)?.tags, ['news', 'product']);
  assert.deepEqual(store.get(b.id)?.tags, ['product']);
  assert.deepEqual(slugs(postsByTag(store, 'Product')), ['one', 'two']);
  assert.throws(() => bulkEdit(store, { ids: [] }), /select/);
});

test('the post page shows the tags', () => {
  const store = createPostStore();
  createPost(store, { title: 'Release 1', author: 'dana', tags: ['Release Notes'], publish: true }, at(0));
  createPost(store, { title: 'Unpublished', author: 'dana' }, at(0));
  assert.deepEqual(postPage(store, 'release-1'), {
    title: 'Release 1',
    byline: 'dana, 2026-10-01',
    body: '',
    tags: [{ name: 'release notes', href: '/tags/release%20notes' }],
  });
  assert.equal(postPage(store, 'unpublished'), null);
});
