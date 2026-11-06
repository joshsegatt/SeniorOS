/**
 * In-memory post store (production uses the same interface over Postgres).
 * @typedef {{ id: string, slug: string, title: string, body: string, author: string, tags: string[], createdAt: string, publishedAt: string | null }} Post
 */
export function createPostStore() {
  /** @type {Post[]} */
  const posts = [];
  let seq = 100;
  /** @param {Post} p */
  const copy = (p) => ({ ...p, tags: [...p.tags] });
  return {
    nextId() {
      seq += 1;
      return `p-${seq}`;
    },
    /** @param {Post} post */
    insert(post) {
      posts.push(copy(post));
      return copy(post);
    },
    /** @param {string} id @param {Partial<Post>} patch */
    update(id, patch) {
      const found = posts.find((p) => p.id === id);
      if (!found) throw new Error(`unknown post ${id}`);
      Object.assign(found, patch);
      return copy(found);
    },
    /** @param {string} id */
    get(id) {
      const found = posts.find((p) => p.id === id);
      return found ? copy(found) : null;
    },
    /** @param {string} slug */
    bySlug(slug) {
      const found = posts.find((p) => p.slug === slug);
      return found ? copy(found) : null;
    },
    all() {
      return posts.map(copy);
    },
  };
}

/** Loads posts exported from production (data/posts-export.json). @param {Post[]} exported */
export function loadExport(exported) {
  const store = createPostStore();
  for (const p of exported) store.insert(p);
  return store;
}
