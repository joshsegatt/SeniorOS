function slugify(title) {
  return title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 80)
    .replace(/^-+|-+$/g, '');
}

export function createBlog({ now = () => new Date() } = {}) {
  const posts = new Map();

  return {
    createPost({ title, body, author }) {
      if (!title?.trim()) throw new RangeError('a post needs a title');
      const base = slugify(title) || 'post';
      let slug = base;
      for (let n = 2; posts.has(slug); n++) slug = `${base}-${n}`;
      const post = { slug, url: `/blog/${slug}`, title: title.trim(), body, author, publishedAt: now().toISOString() };
      posts.set(slug, post);
      return { ...post };
    },
    bySlug(slug) {
      const post = posts.get(slug);
      return post ? { ...post } : null;
    },
    list() {
      return [...posts.values()].map((p) => ({ ...p })).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    },
  };
}
