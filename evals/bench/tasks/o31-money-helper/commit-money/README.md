# bench-shop

A small shop backend used by the team. No dependencies; run the tests with `npm test`.

- `src/lib/money.js`: money helpers (cents)
- `src/legacy/`: old helpers we are moving off
- `src/admin/prices.js`: the admin product page's price form
- `src/import/supplier-costs.js`: monthly supplier cost list (sample in `data/`)
- `src/support/refunds.js`, `src/checkout/tips.js`: refunds, tips
- `src/cart.js`, `src/pricing.js`, `src/server.js`, ...: the rest of the shop
