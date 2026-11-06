# bench-shop

A small backend used by the team. No dependencies; run the tests with `npm test`.

- `src/finance/`: payments and refunds (amounts are integer cents)
  - `checkout.js`: card payments captured at checkout, full refunds when an order is cancelled
  - `webhooks.js`: events from the payment provider (refunds made in the provider dashboard)
  - `reports.js`: the monthly finance report
  - `ledger.js`: customer balances shown in the back office
  - `payouts.js`: reconciliation of the provider's payouts
- `src/support/`: the support tool (partial refunds)
- `data/refunds-2026-10.json`: export of the October refunds table
- `src/cart.js`, `src/pricing.js`, `src/server.js`, ...: the old shop code
