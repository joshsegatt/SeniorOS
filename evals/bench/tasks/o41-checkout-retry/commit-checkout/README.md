# bench-shop

A small shop backend used by the team. No dependencies; run the tests with `npm test`.

The mobile app talks to `src/http/app.js` (`createApp().handle(request)` returns `{ status, body }`). The app runs
as a single Node process and serves many requests at once.

- `src/http/`
  - `app.js`: the routes (`POST /checkout`, `POST /orders/:id/refunds`, `GET /orders/:id`)
  - `idempotency.js`: `Idempotency-Key` support for every POST route. The app sends a new key for each checkout or
    refund the customer starts, and the same key when it retries a request (it retries when a request takes longer
    than its 1.5 s timeout). A request with a key that was already used returns the original response and does
    nothing else; the same key with a different body is refused with 422. Responses with a 5xx status are not kept,
    so a retry after an outage runs again.
  - `kv.js`: the key-value store the idempotency records live in (async, like the Redis it replaces)
- `src/catalog.js`: products and prices
- `src/orders/`: the order store and order creation
- `src/payments/`
  - `gateway.js`: the card payment provider client (a fake one in tests)
  - `charge.js`: charges an order
  - `refunds.js`: partial and full refunds (never more than was charged)
- `src/notifications/outbox.js`: order confirmation emails
- `data/requests-2026-11-03.jsonl`: access log lines from the incident
- `src/cart.js`, `src/pricing.js`, `src/server.js`, ...: the old shop code
