# bench-shop

A small shop backend used by the team. No dependencies; run the tests with `npm test`.

- `src/cart.js`: cart totals and coupons
- `src/inventory.js`: stock levels, kept in ShopKV (`vendor/kv.js` is the vendored ShopKV client)
- `src/money.js`: money helpers (amounts are integer cents)
- `src/pricing.js`, `src/orders.js`, `src/invoice.js`: tax, order totals and invoices
- `src/shipping.js`: shipping cost
- `src/server.js`: user API with token auth
- `src/slug.js`, `src/products.js`, `src/storage.js`: product URLs and image storage keys
- `src/format.js`, `src/legacy.js`: formatting helpers
- `src/labels.js`, `src/checkout.js`: checkout UI strings and markup

## Deployment

The shop runs as 4 app instances behind a load balancer. Anything shared between requests
(stock levels, sessions) lives in ShopKV, never in process memory.

Engineering decisions that constrain changes are recorded in `.senior/decisions.md`. Read them before changing money, tax, shipping or storage code.
