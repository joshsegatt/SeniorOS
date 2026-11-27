# shop-orders

Order placement for the web shop: `POST /checkout` turns a cart into a paid order.

- `src/api.js` HTTP-ish handler (`createApp(deps).handle(req)`), maps errors to status codes.
- `src/order-service.js` the checkout flow (see [docs/checkout-flow.md](docs/checkout-flow.md)).
- `src/catalog.js`, `src/stock.js`, `src/shipping-rates.js`, `src/fulfillment.js` the steps.
- `src/orders.js` order store and order ids.
- Payment gateway contract: [docs/payment-gateway.md](docs/payment-gateway.md). Tests use a stub
  with the same contract (`test/helpers/gateway-stub.js`).

Production error samples are in `data/incident-log.txt`.

```bash
npm test
```
