# bench-shop

Backend for our shop, which runs on a hosted shop platform (we do around 30–40k orders a month).
No dependencies; run the tests with `npm test`.

- `src/shop/api.js`: client for the platform's REST API (config in `config/shop-api.json`)
- `src/shop/orders.js`: orders as our code uses them; the admin order list
- `src/shop/dates.js`: date helpers
- `src/cart.js`, `src/pricing.js`, `src/server.js`, ...: storefront code
