# ledger-service

Small bookkeeping backend for our accountant: imports bank statements (JSON
lines), serves a paginated transactions API, produces the monthly CSV export
and runs a nightly reconciliation.

```
src/
  app.js                 wiring
  store/ledgerStore.js   in-memory store (scan = ordered range read)
  lib/cursor.js          continuation tokens
  lib/paginate.js        fetchPage / eachRow
  import/bankImport.js   statement parser
  export/csv.js          RFC 4180 writer
  export/exportLedger.js monthly CSV export
  api/transactions.js    GET /transactions
  jobs/reconcile.js      per-account balances
  format/money.js        integer-cents helpers
scripts/export.js        CLI export
data/                    real statements
```

Run the tests with `npm test`. Export a statement with
`node scripts/export.js data/statement-2026-10.jsonl out.csv`.
