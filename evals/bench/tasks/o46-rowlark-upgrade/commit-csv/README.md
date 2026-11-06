# bench-shop

A small shop backend used by the team. No npm dependencies; run the tests with `npm test`.

- `src/imports/`: customer list upload, the supplier's nightly stock file
- `src/catalog/price-update.js`: price update sheets from merchandising
- `src/exports/`: orders export (opened in a spreadsheet), the accountant's monthly journal file
- `src/lib/cents.js`: cents to decimal strings
- `src/cart.js`, `src/pricing.js`, `src/server.js`, ...: the old shop code

## Vendored libraries

We don't install packages: third-party code is vendored under `vendor/<name>/` and imported by relative path.

| library | version | used for |
| --- | --- | --- |
| rowlark | 1.8.0 | reading and writing CSV |

To upgrade a library, the new release is unpacked under `vendor-next/<name>/` first; read its `CHANGELOG.md`, then
replace `vendor/<name>/` with it and delete the `vendor-next/<name>/` copy.
