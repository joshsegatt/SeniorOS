import { formatChf } from '../format/money.js';
import { cacheKey } from '../util/keys.js';

// Price-drop alerts. Customers subscribe per SKU; when a price goes down
// every subscriber of that SKU gets one email.

export function createPriceAlerts(outbox) {
  const subscribers = new Map(); // key -> Set<email>

  return {
    subscribe(email, sku) {
      const addr = String(email).trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+$/.test(addr)) throw new TypeError('invalid email');
      const key = cacheKey(sku);
      if (!subscribers.has(key)) subscribers.set(key, new Set());
      subscribers.get(key).add(addr);
    },

    subscriberCount(sku) {
      return subscribers.get(cacheKey(sku))?.size ?? 0;
    },

    priceChanged(sku, oldGross, newGross, product) {
      if (!(newGross < oldGross)) return 0;
      const set = subscribers.get(cacheKey(sku));
      if (!set) return 0;
      for (const to of set) {
        outbox.send({
          to,
          subject: `Price drop: ${product.name}`,
          text: `${product.name} is now ${formatChf(newGross)} (was ${formatChf(oldGross)}).`,
        });
      }
      return set.size;
    },
  };
}
