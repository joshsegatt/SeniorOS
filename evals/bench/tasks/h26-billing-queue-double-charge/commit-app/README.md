# billing-worker

Background worker that charges orders. The checkout API inserts a `chargeOrder`
job per order; this worker picks jobs up, charges the customer through the
payment gateway, marks the order paid and emails the receipt.

## Layout

| File | What it does |
| --- | --- |
| `src/index.js` | Public entry: `createBillingWorker`, `installShutdown`, re-exports |
| `src/queue.js` | `JobQueue`: concurrency, per-attempt timeout, retries with backoff |
| `src/jobStore.js` | Job persistence (in-memory here, Postgres in prod, same interface) |
| `src/jobs/chargeOrder.js` | The `chargeOrder` handler |
| `src/gateway.js` | Gateway HTTP client and `GatewayError` |
| `src/orders.js` | Orders repository |
| `src/clock.js` | System clock and a fake clock for tests |
| `docs/payment-gateway.md` | Gateway API contract (idempotency keys) |

## API

```js
import { createBillingWorker, JobStore, OrderRepo } from './src/index.js';

const worker = createBillingWorker({
  store,            // JobStore (shared by every worker process)
  orders,           // OrderRepo
  gateway,          // { charge({ customerId, amountCents, currency, idempotencyKey }) }
  mailer,           // { sendReceipt({ to, orderId, chargeId, amountCents }) }
  clock,            // optional, { now, setTimeout, clearTimeout }
  concurrency,      // default 4
  maxAttempts,      // default 5
  attemptTimeoutMs, // default 30000; a slower attempt counts as failed and is retried
  backoff,          // { baseMs = 1000, maxMs = 60000 }
});

worker.chargeOrder(orderId); // enqueue job `charge-<orderId>`
worker.queue.start();
await worker.queue.stop();
```

Job statuses in the store: `queued`, `running`, `retrying` (waiting for its
backoff, `runAt` says when), `done`, `failed` (gave up after `maxAttempts`).

## Deployment

Workers run as Kubernetes pods sharing one job store. A deploy sends SIGTERM,
waits 30 s, then SIGKILLs. Pods are replaced one at a time, so the old pod is
gone before its replacement calls `queue.start()`.

## Tests

```bash
npm test
```
