# bench-shop

A small shop backend used by the team. No dependencies; run the tests with `npm test`.

- `src/accounting/`: nightly upload of placed orders to Ledgerly, our accounting provider (`sync.js`), its API
  client (`ledgerly.js`) and the orders/checkpoint store (`store.js`). Tests use `test/support/fake-ledgerly.js`.
- `src/cart.js`: cart totals and coupons
- `src/pricing.js`: tax by region
- `src/server.js`: user API with token auth
- `src/format.js`, `src/legacy.js`: formatting helpers
- `src/labels.js`, `src/checkout.js`: checkout UI strings and markup
