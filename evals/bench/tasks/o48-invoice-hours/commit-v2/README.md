# bench-shop

A small backend used by the team. No dependencies; run the tests with `npm test`.

- `src/db/`: the document store (`store.js`), data migrations (`migrations/`, registered in `migrations/index.js`)
  and their runner (`migrate.js`). Deploys run `npm run migrate` before the new code starts.
- `src/time/entries.js`: logging time (the timesheet page and the mobile app); durations are integer minutes
- `src/billing/invoice.js`: monthly client invoices
- `src/reports/weekly.js`: the team dashboard's weekly hours
- `src/projects/budget.js`: project budgets and the 80% alert
- `src/api/entries.js`: the entries API used by the mobile app and the client portal
- `data/time-entries-2026-10.json`: export of the October time entries
- `src/cart.js`, `src/pricing.js`, `src/server.js`, ...: the old shop code
