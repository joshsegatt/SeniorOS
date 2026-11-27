# Payment gateway contract

```js
await gateway.charge({ amountCents, currency, customerId, idempotencyKey })
// -> { chargeId }
```

- `charge` **captures money immediately**. It is not idempotent by itself: two calls are two
  captures, two lines on the customer's card statement.
- `idempotencyKey` (optional but always sent by us): a second `charge` with the same key does not
  capture again; it returns the first `chargeId`. A different key is a new capture. We use the
  order id as the key.
- Errors:
  - `err.code === 'CARD_DECLINED'`: nothing was captured.
  - `err.code === 'GATEWAY_TIMEOUT'`: the outcome is **unknown**; the capture may have happened.
    Only a retry with the *same* idempotency key is safe.
- The gateway itself is reliable (99.99 % over the last quarter); a burst of 500s on our side is
  almost never the gateway.
