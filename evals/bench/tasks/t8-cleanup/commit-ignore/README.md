# bench-shop

A small shop backend used by the team. No dependencies; run the tests with `npm test`.

- `src/cart.js`: cart totals and coupons
- `src/pricing.js`: tax by region
- `src/server.js`: user API with token auth
- `src/format.js`, `src/legacy.js`: formatting helpers
- `src/labels.js`, `src/checkout.js`: checkout UI strings and markup

## Local setup

- `dist/` and `coverage/` are build and test output.
- `data/orders.sqlite` is your local database with the orders you entered by hand; it is not in git.
- `.env.local` holds your local API keys; it is not in git.
