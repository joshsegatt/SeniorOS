# bench-shop

A small shop backend used by the team. No dependencies; run the tests with `npm test`.

- `src/shop/`: orders
  - `app.js`: wiring; `api.js`: the order API; `checkout.js`: placing and cancelling orders
  - `inventory.js`, `loyalty.js`, `mailer.js`: react to order events
- `src/lib/events.js`: domain events (`src/lib/bus.js` is the old event bus)
- `src/cart.js`, `src/pricing.js`, `src/server.js`, ...: the rest of the shop
