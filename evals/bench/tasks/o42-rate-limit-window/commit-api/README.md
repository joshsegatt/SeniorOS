# bench-shop

A small shop backend used by the team. No dependencies; run the tests with `npm test`.

- `src/api/`: the public catalogue API used by partner integrations
  - `router.js`: `createApi()` → `handle(request)` returning `{ status, body }`
  - `keys.js`: partner API keys
- `src/auth/`: back-office sign-in
  - `login-guard.js`: login attempts per account
  - `passwords.js`: password hashing
- `src/limits/rate-limiter.js`: the request limiter shared by the API and the login guard
- `src/cart.js`, `src/pricing.js`, `src/server.js`, ...: the old shop code

## Limits

Both limits are promised to partners and to the security review, and are counted over a rolling period:

- **Public API**: each API key may make at most **10 requests in any one-second period**. Request number 11
  inside that period gets `429 Too Many Requests`.
- **Back-office login**: at most **5 login attempts per account in any 15 minutes**. Further attempts get
  `429` without the password being checked.

Every component that reads the time takes an optional `now` function (milliseconds, defaults to `Date.now`).
