# Dashboard caching

The daily summary aggregates the whole ledger for a store and a day. In production that is a
scan of `ledger_entries`; the database team capped it, so the dashboard caches summaries.

## Rules

1. **One cache entry per (store, day).** A summary for one day is never served for another day.
2. **Fresh after every write.** Every write path into the ledger (sale, refund, POS batch import)
   invalidates the (store, day) entries it touches, in the same call. A manager who records a
   refund and reloads the dashboard sees it immediately.
3. **TTL is a safety net, not the freshness mechanism.** `DASHBOARD_CACHE_TTL_MS` (24 h) only
   bounds memory for days nobody writes to any more. Lowering it does not make data fresh: a write
   inside the TTL window would still be served stale until expiry.
4. **Ledger budget.** Without writes, a (store, day) summary is aggregated at most once per TTL.
   Dashboards auto-refresh every 30 s on ~400 store screens; recomputing more often than that
   breaches the database budget.

## Clock

Time comes from the injected clock. "Today" is the UTC date of `clock.now()`.
