# bench-shop

A small shop backend used by the team. No dependencies.

- `src/cart.js`: cart totals and coupons
- `src/pricing.js`: tax by region
- `src/money.js`, `src/receipt.js`: money formatting and printed receipts
- `src/server.js`: user API with token auth
- `src/format.js`, `src/legacy.js`: formatting helpers
- `src/labels.js`, `src/checkout.js`: checkout UI strings and markup

## Tests

- `npm test`: unit tests (`test/`).
- `npm run test:e2e`: end-to-end receipt checks (`e2e/`).

CI runs both on every pull request (`.github/workflows/ci.yml`).
