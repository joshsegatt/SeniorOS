# Acme rate limits

Acme allows 50 requests/second per account, measured over sliding windows,
and answers 429 above that. Repeated 429s get the account suspended for an hour.

We run the limiter at `capacity: 45, ratePerSec: 45` to keep a margin.

## What the limiter must guarantee

For one key, across every instance that shares the store:

1. **Never over budget.** Over any interval of length T, at most
   `capacity + ratePerSec * T` requests are admitted.
2. **No needless denial.** A request is only denied when the bucket really has
   fewer than `n` tokens; steady traffic at or below `ratePerSec` must get
   through, whatever the spacing between requests.
3. Both hold regardless of how many pods call at the same moment.

## Deployment facts

- 6 sync pods in production (autoscaled to 12 at month end), plus cron jobs
  that also call Acme. All share the Redis store.
- Hosts are NTP-synced but drift: we have seen pod clocks up to ~1 s apart.
