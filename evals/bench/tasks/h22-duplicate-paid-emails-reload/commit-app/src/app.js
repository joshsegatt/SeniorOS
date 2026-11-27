import { attachAuditLog } from './audit/auditLog.js';
import { createBus } from './bus/eventBus.js';
import { loadConfig } from './config/config.js';
import { reloadConfig, watchConfig } from './config/reload.js';
import { createRecordingHttp } from './subscribers/webhooks.js';
import { createLoyaltyLedger } from './loyalty/ledger.js';
import { createMailer } from './mail/sender.js';
import { createTransport } from './mail/transport.js';
import { createOrders } from './orders/orders.js';
import { wireSubscribers } from './subscribers/index.js';

export function createApp(rawConfig, { transport = createTransport(), http = createRecordingHttp() } = {}) {
  const logs = [];
  const bus = createBus();
  const config = loadConfig(rawConfig);
  const app = {
    bus,
    config,
    transport,
    http,
    logs,
    log: (line) => logs.push(line),
    loyalty: createLoyaltyLedger(),
    orders: createOrders(bus),
  };
  app.mailer = createMailer({ transport, smtp: config.smtp, log: app.log });
  app.audit = attachAuditLog(bus);
  wireSubscribers(app);
  app.reloadConfig = (raw) => reloadConfig(app, raw);
  app.watchConfig = (source) => watchConfig(app, source);
  return app;
}
