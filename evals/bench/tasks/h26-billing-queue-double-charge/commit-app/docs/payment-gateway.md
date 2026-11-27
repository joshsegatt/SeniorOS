# Payment gateway contract

`POST /v1/charges` with header `Idempotency-Key: <key>`.

- The key is mandatory. The gateway remembers keys for 7 days.
- First request with a key: the gateway creates the charge and stores the response.
- Same key again after that request finished: no new charge; the gateway replays
  the stored response (same charge id), status 200.
- Same key again while the first request is still being processed: HTTP 409,
  surfaced by our client as `GatewayError` with `code: 'idempotency_in_progress'`
  and `retryable: true`. Nothing is charged by the 409 request.
- A charge can succeed on the gateway side even when our side sees a network
  error or a timeout (the response got lost). Retrying with the same key is the
  documented way to find out what happened.
