# bench-shop

A small shop backend used by the team. No dependencies; run the tests with `npm test`, the app with `npm start`.

- `config/`: settings per environment (`default.json` overlaid with `<APP_ENV>.json`), loaded by `src/config.js`
- `src/main.js`, `src/http.js`: app entry point and back-office HTTP API
- `src/orders/store.js`: orders
- `src/reports/daily.js`: daily sales for the accountant
- `src/lib/dates.js`: date helpers
- `src/cart.js`, `src/pricing.js`, `src/server.js`, `src/format.js`, `src/legacy.js`, `src/labels.js`, `src/checkout.js`: older shop modules
