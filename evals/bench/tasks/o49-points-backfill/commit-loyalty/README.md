# bench-shop

A small backend used by the team. No dependencies; run the tests with `npm test`.

- `src/db/store.js`: the document store (production runs the same interface over Postgres)
- `src/orders/orders.js`: paid orders from checkout, cancellations
- `src/loyalty/points.js`: loyalty points, live since 2026-11-03: earned on paid orders, redeemed at checkout
- `src/loyalty/ledger.js`: the points history, the points page in the app, the nightly balance check
- `scripts/`: one-off jobs. Each exports `run(store)` and runs with `node scripts/<name>.js`
  (`STORE_FILE` points it at the database; locally it defaults to `data/store.json`)
- `data/store.json`: a small local copy of the data for development
- `src/cart.js`, `src/pricing.js`, `src/server.js`, ...: the old shop code
