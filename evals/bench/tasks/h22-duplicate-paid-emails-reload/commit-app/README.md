# velowerk-orders

Order backend of the Velo Werk bike shop: payments, customer emails,
loyalty points, ERP webhooks and the compliance audit trail.

```
src/
  app.js                     wiring (createApp)
  bus/eventBus.js            in-process events
  orders/orders.js           order lifecycle, emits order.paid / order.refunded
  subscribers/index.js       wires business reactions to order events
  subscribers/mailOnPaid.js  customer emails
  subscribers/loyalty.js     loyalty points per order
  subscribers/webhooks.js    ERP webhooks (+ recording HTTP client)
  loyalty/ledger.js          points ledger
  mail/sender.js             mailer with retry
  mail/transport.js          SMTP relay adapter
  audit/auditLog.js          audit trail (must record every event exactly once)
  config/config.js           config validation
  config/reload.js           hot reload from the config watcher
  replay.js                  replays an operations journal
scripts/replay.js            CLI: node scripts/replay.js data/ops-2026-11-24.json
data/                        production journals
```

Config is hot-reloaded: ops edit `config.json` on the server and the watcher
pushes the new content to `reloadConfig`. A reload that fails validation is
rejected and the running config stays in place.

`npm test` runs the suite.
