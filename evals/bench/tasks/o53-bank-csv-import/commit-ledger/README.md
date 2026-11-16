# bench-shop

Bookkeeping for small businesses and freelancers. No dependencies; run the tests with `npm test`.

- `src/ledger/`: the ledger
  - `store.js`: in-memory ledger (production uses the same interface over Postgres)
  - `transactions.js`: `addTransaction`, the one way a transaction gets into the ledger (validates and categorizes it)
  - `manual.js`: the "add payment" form
  - `money.js`, `dates.js`: parsing and formatting for amounts (francs, cents) and Swiss dates
  - `categories.js`: automatic categories from the description
- `src/reports/monthly.js`: the monthly summary on the dashboard
- `src/import/`: importers for files customers upload
- `data/statements/`: statements downloaded from Alpstein Bank e-banking
- `src/cart.js`, `src/pricing.js`, `src/server.js`, ...: the old shop code this project grew out of
