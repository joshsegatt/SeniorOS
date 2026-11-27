# sales-dashboard

Daily sales summary per store for the shop managers' dashboard.

- `src/dashboard.js` serves `dailySummary(storeId, day?)` from a cache in front of the ledger.
  `day` is `YYYY-MM-DD` (UTC) and defaults to today according to the injected clock.
- `src/sales-service.js` is every write path into the ledger: sales, refunds, POS batch imports.
- `src/http.js` routes (`GET /dashboard`, `POST /sales`, `POST /refunds`, `POST /imports`).
- `src/ledger.js` in-memory ledger (production: the `ledger_entries` table).
- `src/ttl-cache.js`, `src/config.js`, `src/clock.js`, `src/metrics.js` helpers.

Caching rules: [docs/caching.md](docs/caching.md). All time goes through an injected
`clock` (`{ now(): ms }`) so tests can move time.

```bash
npm test
```
