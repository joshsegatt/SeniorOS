# bench-shop

Backend for the merchant dashboard. No dependencies; run the tests with `npm test`.

- `src/api/`: dashboard API handlers (`exports.js`, `reports.js`, `team.js`) and shared HTTP helpers (`http.js`)
- `src/billing/client.js`: client for the billing service (plans and their features)
- `src/cart.js`, `src/pricing.js`, `src/server.js`, ...: the storefront
