# bench-shop

A small shop backend used by the team. No dependencies; run the tests with `npm test`.

- `src/accounts/`: customer accounts (`customers.js`), sign-in and sessions (`auth.js`), orders (`orders.js`), all
  stored in the in-memory database from `db.js`
- `src/marketing/newsletter.js`: who gets the weekly newsletter
- `src/reports/revenue.js`: revenue by country, used by accounting for the monthly close
- `src/cart.js`: cart totals and coupons
- `src/pricing.js`: tax by region
- `src/server.js`: user API with token auth
- `src/format.js`, `src/legacy.js`: formatting helpers
- `src/labels.js`, `src/checkout.js`: checkout UI strings and markup
