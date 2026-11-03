# bench-shop

A small shop backend used by the team. No dependencies; run the tests with `npm test`.

- `src/http/`: the web backend
  - `app.js`: routes for the storefront API, account pages and the `/admin` back office
  - `router.js`: path matching
  - `auth.js`: sessions and access to the back office
- `src/cart.js`, `src/pricing.js`, `src/server.js`, ...: shared shop code
