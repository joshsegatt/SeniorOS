import { createPriceAlerts } from './alerts/priceAlerts.js';
import { createCatalog } from './catalog/catalog.js';
import { importFeed } from './import/feed.js';
import { createOutbox } from './mail/outbox.js';
import { createPriceCache } from './pricing/priceCache.js';
import { computeGross } from './pricing/rules.js';

export function createShop() {
  const outbox = createOutbox();
  const app = {
    catalog: createCatalog(),
    prices: createPriceCache(computeGross),
    outbox,
    alerts: createPriceAlerts(outbox),
  };
  app.importFeed = (text) => importFeed(app, text);
  return app;
}
