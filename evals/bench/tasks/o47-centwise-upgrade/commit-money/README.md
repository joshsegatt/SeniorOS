# bench-shop

A small shop backend used by the team. No npm dependencies; run the tests with `npm test`.

Amounts are integer cents everywhere. Shop prices are in euros. VAT and discounts that land on half a cent round up
(52.5 cents is 53), as on every invoice we have issued.

- `src/billing/`: VAT and invoices
- `src/promotions/`: discount codes and loyalty points
- `src/support/adjustments.js`: the support tool's goodwill credit form
- `src/catalog/supplier-prices.js`: the supplier's price list import
- `src/shipping/rates.js`: shipping prices
- `src/cart.js`, `src/pricing.js`, `src/server.js`, ...: the old shop code

## Vendored libraries

We don't install packages: third-party code is vendored under `vendor/<name>/` and imported by relative path.

| library | version | used for |
| --- | --- | --- |
| centwise | 2.4.1 | cents arithmetic, parsing and formatting |

To upgrade a library, the new release is unpacked under `vendor-next/<name>/` first; read its `CHANGELOG.md`, then
replace `vendor/<name>/` with it and delete the `vendor-next/<name>/` copy.
