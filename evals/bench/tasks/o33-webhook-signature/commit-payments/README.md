# bench-shop

A small shop backend used by the team. No dependencies; run the tests with `npm test`.

- `src/payments/`: Paylane payment webhooks (`POST /webhooks/paylane`)
  - `server.js`: the endpoint
  - `webhooks.js`: checks the signature, then hands the event on
  - `signature.js`: Paylane's `Paylane-Signature` scheme
  - `config.js`: production settings, read from `config/paylane.local.json` on the server
- `data/failed-webhooks.json`: deliveries our endpoint refused, exported from Paylane's dashboard
- `src/cart.js`, `src/pricing.js`, `src/server.js`, ...: the old shop code
