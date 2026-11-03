# bench-shop

Backend for our shop. No dependencies; run the tests with `npm test`.

- `src/fx/`: exchange rates (client for the reference-rate service, config in `config/rates-api.json`) and EUR conversion
- `src/billing/invoice.js`: EUR figures we book for invoices in other currencies
- `src/finance/`: finance reports; `sample.js` generates a quarter of transactions shaped like production
- `src/cart.js`, `src/pricing.js`, `src/server.js`, ...: storefront code
