# bench-shop

A small shop backend used by the team. No dependencies; run the tests with `npm test`.

- `src/catalog/`: product catalog, back-office product creation, nightly supplier feed import
- `src/storefront/`: product cards and search for the web shop
- `src/api/products.js`: product JSON for the mobile app
- `src/orders/invoice.js`: plain-text invoices
- `src/lib/html.js`: HTML escaping
- `src/cart.js`, `src/pricing.js`, `src/server.js`, `src/format.js`, `src/legacy.js`, `src/labels.js`, `src/checkout.js`: older shop modules
