# bench-shop

A small shop backend used by the team. No dependencies; run the tests with `npm test`.

- `src/db/`: document database clients (`memory.js` for dev and tests, `http.js` for staging and production), dev data (`seed.js`)
- `src/catalog/products.js`, `src/inventory/stock.js`, `src/purchasing/suppliers.js`: data access
- `src/storefront/product-page.js`: product page data
- `src/cart.js`, `src/pricing.js`, `src/server.js`, `src/format.js`, `src/legacy.js`, `src/labels.js`, `src/checkout.js`: older shop modules
