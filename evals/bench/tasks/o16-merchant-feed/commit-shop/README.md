# bench-shop

A small shop backend used by the team. No dependencies; run the tests with `npm test`, the app with `npm start`.

- `config/`: settings per environment (`default.json` overlaid with `<APP_ENV>.json`), loaded by `src/config.js`
- `src/main.js`, `src/http.js`: app entry point and storefront server
- `src/catalog/products.js`: product catalog
- `src/storefront/product-page.js`: product pages
- `src/lib/money.js`: price formatting
- `src/cart.js`, `src/pricing.js`, `src/server.js`, `src/format.js`, `src/legacy.js`, `src/labels.js`, `src/checkout.js`: older shop modules
