# bench-shop

A small shop backend used by the team. No dependencies; run the tests with `npm test`.

- `src/catalog/`: the product catalog
  - `categories.js`, `products.js`: catalog data and the admin operations on it
  - `browse.js`: category pages in the shop
  - `breadcrumbs.js`: product page breadcrumbs
  - `feed.js`: nightly Google Merchant Center feed
- `data/catalog-snapshot.json`: anonymised snapshot of the production catalog (taken Oct 14)
- `src/cart.js`, `src/pricing.js`, `src/server.js`, ...: the rest of the shop
