import { createEvents } from '../lib/events.js';
import { createInventory, wireInventory } from './inventory.js';
import { createLoyalty, wireLoyalty } from './loyalty.js';
import { wireMailer } from './mailer.js';
import { createCheckout } from './checkout.js';
import { createOrderApi } from './api.js';

/** Wires the shop together. `payments` is the payment provider client ({ charge, refund }). */
export function createShopApp({ stock, payments }) {
  const events = createEvents();
  const inventory = createInventory(stock);
  const loyalty = createLoyalty();
  const outbox = [];
  wireInventory(events, inventory);
  wireLoyalty(events, loyalty);
  wireMailer(events, outbox);
  const checkout = createCheckout({ events, payments, inventory });
  return { api: createOrderApi({ checkout }), checkout, inventory, loyalty, outbox };
}
