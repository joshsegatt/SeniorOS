# bench-shop

A small shop backend used by the team. No dependencies; run the tests with `npm test`.

- `src/giftcards/`: gift cards (amounts are integer cents)
  - `backend.js`: where card records live. Production uses `fileBackend` (`data/giftcards.json`); tests use `memoryBackend`. Both are async, like the database they replace.
  - `store.js`: the gift card store (`get`, `put`, `list`) over a backend
  - `cards.js`: issuing cards, blocking them and reading a balance
  - `redeem.js`: paying with a card at checkout (a card never goes below zero)
  - `credit.js`: putting money back on a card (refunds of orders paid by gift card)
  - `statement.js`: the card history shown in the customer account
- `src/orders/`: orders paid with a gift card
  - `checkout.js`: places an order and redeems the gift card
  - `cancel.js`: cancels an order and credits the gift card back. Runs from the back office and from the nightly job that cancels unshipped orders, so it can run while the customer is shopping with the same card.
- `data/giftcards.json`: a copy of the production card file
- The app runs as a single Node process and serves many requests at once.
- `src/cart.js`, `src/pricing.js`, `src/server.js`, ...: the old shop code
