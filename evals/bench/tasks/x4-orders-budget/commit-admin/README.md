# bench-shop

A small shop backend used by the team. No dependencies; run the tests with `npm test`.

- `src/admin/`: the admin back-office API (`app.js`) and its database access (`db.js`)
- `src/cart.js`: cart totals and coupons
- `src/pricing.js`: tax by region
- `src/server.js`: user API with token auth
- `src/format.js`, `src/legacy.js`: formatting helpers
- `src/labels.js`, `src/checkout.js`: checkout UI strings and markup
