# bench-shop

A small shop backend used by the team. No dependencies; run the tests with `npm test`.

- `src/customers/`: customer validation (`model.js`), persistence (`repo.js`), accounting tool import (`import.js`)
- `src/api/customers.js`: customers API (sign-up, account settings)
- `src/reports/customers-csv.js`: customer list export for sales
- `src/billing/invoices.js`: invoices
- `data/`: sample exports from other tools
- `test/factories.js`: shared test helpers
- `src/cart.js`, `src/pricing.js`, `src/server.js`, `src/format.js`, `src/legacy.js`, `src/labels.js`, `src/checkout.js`: older shop modules
