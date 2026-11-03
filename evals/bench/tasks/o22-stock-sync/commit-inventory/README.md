# bench-shop

Backend for our merch shop (about 42k products). No dependencies; run the tests with `npm test`.

- `src/inventory/catalog.js`: the product catalog, persisted through `storage.js`
- `src/inventory/search-index.js`: keeps storefront search in step with stock
- `src/inventory/seed.js`: local dev data shaped like production
- `data/`: sample files from the warehouse (the real nightly file has 5–8k lines)
- `src/cart.js`, `src/pricing.js`, `src/server.js`, ...: storefront code
