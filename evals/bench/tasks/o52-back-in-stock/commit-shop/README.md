# bench-shop

A small shop backend used by the team. No dependencies; run the tests with `npm test`.

- `src/catalog/`: the in-memory tables (`store.js`; production uses the same interface over Postgres) and product lookups
- `src/admin/products.js`: the admin product screen (stock corrections, product view)
- `src/warehouse/deliveries.js`: deliveries booked in by the warehouse app
- `src/orders/orders.js`: checkout, takes stock and sends the order confirmation
- `src/email/`: the outbox (`sendEmail`) and the templates the email service knows
- `src/shop/`: the storefront product page and product URLs
- `docs/issues/`: tickets
- `src/cart.js`, `src/pricing.js`, `src/server.js`, ...: the old shop code
