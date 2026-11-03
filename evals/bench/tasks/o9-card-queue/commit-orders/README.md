# bench-shop

A small shop backend used by the team. No dependencies; run the tests with `npm test`.

- `src/orders/`: order store and lifecycle (place, bank transfer payment, shipping, refund window)
- `src/payments/webhook.js`: events from the card payment provider
- `src/warehouse/queue.js`: what the warehouse packs next
- `src/finance/payouts.js`: card payout reconciliation
- `src/cart.js`, `src/pricing.js`, `src/server.js`, `src/format.js`, `src/legacy.js`, `src/labels.js`, `src/checkout.js`: older shop modules
