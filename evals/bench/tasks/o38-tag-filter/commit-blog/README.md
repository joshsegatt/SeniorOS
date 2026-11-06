# bench-shop

A small backend used by the team. No dependencies; run the tests with `npm test`.

- `src/blog/`: the company blog
  - `posts.js`: the post editor (create, edit, publish)
  - `import.js`: imports markdown posts (front matter + body) from the old static site
  - `tags.js`: tag pages and the tag cloud in the sidebar
  - `feed.js`: RSS feed per tag (`/tags/<tag>/rss.xml`)
- `src/admin/`: the bulk editor on the admin posts list
- `src/web/`: the post page
- `data/`: support exports
- `src/cart.js`, `src/pricing.js`, `src/server.js`, ...: the old shop code
