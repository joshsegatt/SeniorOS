# bench-shop

A small shop backend used by the team. No dependencies; run the tests with `npm test`.

- `src/catalog/`: the product catalog
  - `store.js`: loads `data/products.json` (the saved product records) and keeps them in memory
  - `records.js`: `readProduct`, the one place that turns a saved record into the product shape the code uses
  - `products.js`: the admin product form (create and edit)
  - `import.js`: the supplier CSV import (nightly job)
  - `feed.js`: the merchant feed export
  - `search.js`: catalog search
  - `units.js`: parsing helpers for form and CSV input
- `src/shipping/`: shipping quotes at checkout, parcel labels for the carrier, customs declarations for non-EU parcels
- `src/cart.js`, `src/pricing.js`, `src/server.js`, ...: the old shop code

## Stored records

Product records are saved by every version of the admin and of the import, and they are never rewritten in place:
`data/products.json` (and the production table) holds records in older shapes. Code never reads a raw record: it
gets products from the catalog store, which passes each record through `readProduct` (`src/catalog/records.js`).
When the way a field is stored changes, writers save the new shape and `readProduct` upgrades the older shapes,
so every reader keeps working with every record. Prices are an example: records saved before March 2025 have a
`price` euro string, newer ones integer `priceCents`.
