# bench-shop

A small backend used by the team. No dependencies; run the tests with `npm test`.

We hire out construction equipment (excavators, compactors, scaffold towers) from the yard. Customers book a pickup
day and a return day online; the quote they see is what we invoice, plus the refundable deposit.

- `src/hire/`: equipment hire
  - `catalog.js`: the equipment we hire out and its rates (amounts in Swiss centimes)
  - `dates.js`: hire days (`YYYY-MM-DD`)
  - `pricing.js`: hire days and quotes
  - `availability.js`: whether an item is free for the requested days
  - `late-fees.js`: fees for machines returned after their return day
  - `invoice.js`: invoice lines and CHF formatting
- `src/api/`: `GET /v1/quote`
- `data/`: support exports
- `docs/adr/`: decisions we keep coming back to
- `src/cart.js`, `src/pricing.js`, `src/server.js`, ...: the old shop code

## Rates

Every item has a daily rate. Some also have a weekly rate: each full 7 hire days are charged at the weekly rate and
the remaining days at the daily rate. The damage waiver is optional and charged per hire day.
