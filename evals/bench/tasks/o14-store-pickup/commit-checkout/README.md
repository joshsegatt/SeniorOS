# bench-shop

A small shop backend used by the team. No dependencies; run the tests with `npm test`.

- `config/shop.json`: shop settings
- `src/shipping/methods.js`: shipping methods offered at checkout
- `src/checkout/`: validation, quote and order placement
- `src/orders/repo.js`: order persistence
- `src/warehouse/manifest.js`: evening carrier manifests
- `src/emails/`, `src/jobs/`: confirmation emails and the job that sends them
- `src/cart.js`, `src/pricing.js`, `src/server.js`, `src/format.js`, `src/legacy.js`, `src/labels.js`, `src/checkout.js`: older shop modules
