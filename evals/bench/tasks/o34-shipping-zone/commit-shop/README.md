# bench-shop

A small shop backend used by the team. No dependencies; run the tests with `npm test`.

We ship from Germany: €4.90 within Germany, €9.90 to the rest of the EU, €24.90 everywhere else. Prices are net;
VAT is charged at the destination country's rate inside the EU and not at all on exports.

- `src/shop/`: addresses, shipping, VAT, delivery estimates and orders
  - `addresses.js`: the address form in the web checkout, and how addresses are shown
  - `countries.js`: the countries we ship to
- `src/api/`: the JSON API used by the iOS and Android apps
- `src/import/`: imports B2B customer addresses from the ERP's CSV export
- `data/`: support exports
- `src/cart.js`, `src/pricing.js`, `src/server.js`, ...: the old shop code
