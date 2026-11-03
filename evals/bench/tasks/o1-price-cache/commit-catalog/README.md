# bench-shop

A small shop backend used by the team. No dependencies; run the tests with `npm test`.

- `src/catalog/`: product catalog (`catalog.js`), its database access (`db.js`) and cart pricing (`cart-pricing.js`)
- `src/cart.js`: cart totals and coupons
- `src/pricing.js`: tax by region
- `src/server.js`: user API with token auth
- `src/format.js`, `src/legacy.js`: formatting helpers
- `src/labels.js`, `src/checkout.js`: checkout UI strings and markup
