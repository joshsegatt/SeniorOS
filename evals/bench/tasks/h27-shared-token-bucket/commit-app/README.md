# acme-sync

Syncs orders and shipments with the Acme partner API. Acme enforces a hard
per-account request limit, so every pod goes through one shared token-bucket
limiter whose state lives in Redis.

## Layout

| File | What it does |
| --- | --- |
| `src/rateLimiter.js` | `createRateLimiter`: `tryTake` and `acquire` |
| `src/tokenBucket.js` | Bucket math (refill, wait time, encoding) |
| `src/stores/memoryStore.js` | In-process store (tests, local dev) |
| `src/stores/redisStore.js` | Production store (Redis, CAS via Lua) |
| `src/acmeClient.js` | Acme HTTP client, calls `limiter.acquire('acme')` per request |
| `src/clock.js` | System clock and a manual clock for tests |
| `docs/rate-limits.md` | How we size the limiter, the guarantees it must give |

## Limiter API

```js
const limiter = createRateLimiter({ store, clock, capacity: 45, ratePerSec: 45 });

await limiter.tryTake(key, n = 1);
// -> { allowed: boolean, remaining: number, retryAfterMs: number }

await limiter.acquire(key, { n = 1, maxWaitMs = Infinity });
// waits until allowed; throws RateLimitError if the wait would exceed maxWaitMs
```

`clock` is `{ now(), sleep(ms) }` and defaults to the system clock.

## Store interface

Every store (memory, Redis) implements exactly these async methods, and the
limiter must work with any of them:

- `get(key)` -> `string | null`
- `set(key, value)`
- `compareAndSet(key, expected, next)` -> `boolean`: atomically replaces the
  value with `next` only if it currently equals `expected` (`null` means "key
  does not exist yet").
- `delete(key)` (admin tooling only)

Values are opaque strings to the store.

## Tests

```bash
npm test
```
