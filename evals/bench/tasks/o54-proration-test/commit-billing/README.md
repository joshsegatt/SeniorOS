# bench-shop

A small backend used by the team. No dependencies; run the tests with `npm test`.

Customers subscribe to a monthly plan. A plan change in the middle of a billing period is prorated: the customer gets
a credit for the unused days of the old plan and is charged for the same days on the new plan, on one invoice.

- `src/billing/`: plans and subscriptions
  - `plans.js`: the plan catalog and prices
  - `dates.js`: billing days (`YYYY-MM-DD`, UTC)
  - `proration.js`: credit and charge for a mid-period plan change
  - `subscriptions.js`: plan changes and renewals
  - `invoices.js`: invoice lines, totals and the plain-text invoice
  - `money.js`: amounts in cents
- `src/api/`: `POST /v1/subscriptions/:id/plan`
- `data/`: support exports
- `src/cart.js`, `src/pricing.js`, `src/server.js`, ...: the old shop code
