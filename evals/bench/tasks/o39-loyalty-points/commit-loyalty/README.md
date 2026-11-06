# bench-shop

A small backend used by the team. No dependencies; run the tests with `npm test`.

Members of the coffee loyalty program earn 1 point per whole dollar spent and a free drink every 10 purchases.

- `src/loyalty/`: the loyalty program
  - `members.js`: customers activate the card they got at the counter
  - `points.js`: points balance (app and receipts)
  - `rewards.js`: the free-drink stamp card
  - `store.js`: members and purchases
- `src/pos/`: store registers
  - `register.js`: purchases rung up on a connected register
  - `sync.js`: purchases a register queued while the store was offline, uploaded when it reconnects
- `src/app/orders.js`: mobile app orders for pickup
- `src/email/monthly.js`: the monthly purchase history email
- `data/`: register sync batches kept for debugging
- `src/cart.js`, `src/pricing.js`, `src/server.js`, ...: the old shop code
