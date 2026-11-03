# bench-shop

A small backend used by the team. No dependencies; run the tests with `npm test`.

Every new account starts on a 14-day trial of the Pro plan. In the last three days of the trial the owner
gets a reminder email; when the trial ends without an upgrade, the account moves to the Free plan.

- `src/billing/`: accounts, plans, trial reminders and expiry (daily jobs)
- `src/admin/`: back-office tools for the sales team
- `src/web/`: account page
- `data/`: support exports
- `src/cart.js`, `src/pricing.js`, `src/server.js`, ...: the old shop code
