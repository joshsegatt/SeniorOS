# month-close-reconciliation

Builds the monthly totals per currency from the transaction exports of our bank
and card accounts. Finance compares them with the bank statements at month close.

- `src/totals.js`: `monthlyTotals(statements)`, totals per month and currency in
  integer minor units (cents / Rappen).
- `src/statement.js`: turns one source export into transactions.
- `src/amount.js`: amount parsing.
- `src/dates.js`: date parsing per source.
- `src/sources.js`: the source registry.
- `src/report.js`: text report.
- `scripts/monthly-report.js`: `npm run report -- data/statements-2026-10.json`.

Source formats (amounts and dates differ per bank) are in `docs/sources.md`.

```bash
npm test
```
