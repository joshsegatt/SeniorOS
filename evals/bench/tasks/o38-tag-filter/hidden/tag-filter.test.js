import test from 'node:test';
import assert from 'node:assert/strict';
import { createPostStore } from '../../src/blog/store.js';
import { createPost } from '../../src/blog/posts.js';
import { importMarkdown } from '../../src/blog/import.js';
import { postsByTag, tagCloud } from '../../src/blog/tags.js';
import { tagFeed } from '../../src/blog/feed.js';
import { bulkEdit } from '../../src/admin/bulk-edit.js';
import { postPage } from '../../src/web/post-page.js';

const t0 = new Date('2026-10-20T09:00:00Z');
const at = (days) => () => new Date(t0.getTime() + days * 86_400_000);
const slugs = (posts) => posts.map((p) => p.slug).sort();

/** An older release post from the editor, then three drafts tagged and published last week with the bulk editor. */
function blog(typed = 'Release Notes ') {
  const store = createPostStore();
  createPost(store, { title: 'Release notes 4.1', author: 'dana', tags: ['Release Notes', 'product'], publish: true }, at(0));
  const ids = ['Release notes 4.2', 'Release notes 4.2.1', 'Release notes API v3'].map(
    (title) => createPost(store, { title, author: 'dana', tags: ['product'] }, at(1)).id,
  );
  bulkEdit(store, { ids, addTags: [typed], publish: true }, at(7));
  return { store, ids };
}

const all = ['release-notes-4-1', 'release-notes-4-2', 'release-notes-4-2-1', 'release-notes-api-v3'];

test('the reported case: the tag page lists posts tagged with the bulk editor', () => {
  for (const typed of ['Release Notes ', 'release notes', ' Release  notes']) {
    const { store } = blog(typed);
    assert.deepEqual(slugs(postsByTag(store, 'Release Notes')), all, typed);
    assert.deepEqual(slugs(postsByTag(store, 'release notes')), all, typed);
  }
});

test('the tag cloud counts posts tagged with the bulk editor under the same tag', () => {
  const { store } = blog();
  const entries = tagCloud(store).filter((e) => /release/i.test(e.tag));
  assert.deepEqual(entries, [{ tag: 'release notes', count: 4 }]);
});

test('the tag RSS feed includes posts tagged with the bulk editor', () => {
  const { store } = blog();
  const rss = tagFeed(store, 'Release Notes');
  assert.equal(rss.match(/<item>/g)?.length, 4);
  for (const slug of all) assert.ok(rss.includes(`<guid>https://blog.example.com/posts/${slug}</guid>`), slug);
});

test('the post page shows a bulk-edited tag like one set in the post editor', () => {
  const { store } = blog();
  const tags = (slug) => (postPage(store, slug)?.tags ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
  assert.deepEqual(tags('release-notes-4-2'), tags('release-notes-4-1'));
  assert.deepEqual(tags('release-notes-api-v3'), tags('release-notes-4-1'));
});

test('adding or removing a tag in bulk matches the tag a post already has', () => {
  const store = createPostStore();
  const post = createPost(store, { title: 'Release notes 4.1', author: 'dana', tags: ['release notes'], publish: true }, at(0));
  bulkEdit(store, { ids: [post.id], addTags: ['Release Notes '] }, at(1));
  assert.equal(postPage(store, 'release-notes-4-1')?.tags.length, 1);
  assert.deepEqual(tagCloud(store), [{ tag: 'release notes', count: 1 }]);
  bulkEdit(store, { ids: [post.id], removeTags: ['Release Notes'] }, at(2));
  assert.deepEqual(postPage(store, 'release-notes-4-1')?.tags, []);
  assert.deepEqual(postsByTag(store, 'release notes'), []);
});

test('the post editor, the importer and plain bulk edits are unchanged', () => {
  const store = createPostStore();
  const a = createPost(store, { title: 'One', author: 'dana', tags: ['news'] }, at(0));
  importMarkdown(store, '---\ntitle: Two\ndate: 2026-10-21\ntags: [News, Product]\n---\nBody\n', at(0));
  bulkEdit(store, { ids: [a.id], addTags: ['product', ''], publish: true }, at(3));
  assert.deepEqual(store.get(a.id)?.tags, ['news', 'product']);
  assert.deepEqual(slugs(postsByTag(store, 'Product')), ['one', 'two']);
  assert.deepEqual(tagCloud(store), [{ tag: 'news', count: 2 }, { tag: 'product', count: 2 }]);
  assert.equal(tagFeed(store, 'news').match(/<item>/g)?.length, 2);
});
