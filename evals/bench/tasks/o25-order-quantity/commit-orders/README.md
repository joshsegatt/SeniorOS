# bench-shop

A small shop backend used by the team. No dependencies; run the tests with `npm test`.

- `src/orders/`: orders
  - `shop.js`: what the storefront and the account pages call
  - `checkout.js`, `cancel.js`, `fulfilment.js`: placing, cancelling and shipping orders
  - `orders.js`: order storage
  - `inventory.js`: stock levels
  - `pricing.js`: order totals (VAT, shipping)
- `src/cart.js`, `src/pricing.js`, `src/server.js`, ...: the rest of the shop
